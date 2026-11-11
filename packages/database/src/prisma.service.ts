import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Request-scoped tenant binding (Row Level Security).
 *
 * The tenant is bound to ONE Postgres connection for the whole request by
 * running the request inside an interactive transaction and setting the RLS
 * context with `SET LOCAL` (transaction scope). This matters because Prisma
 * uses a connection POOL: a session-scoped `set_config()` would only stick to
 * whichever connection happened to serve that one statement, so the rest of
 * the request could run under a different (or no) tenant — returning empty
 * results or, worse, rows from another tenant.
 *
 * WHY A PROXY AND NOT PROPERTY PATCHING
 * -------------------------------------
 * Prisma builds the interactive-transaction client by DERIVING its members
 * from the base client. If the base client had its own properties replaced
 * (`Object.defineProperty(this, '$executeRawUnsafe', ...)`), the transaction
 * client would inherit the replacement and every "transaction" statement
 * would silently run on the BASE connection instead of the transaction's one.
 * That is not theoretical: `SET LOCAL ROLE` outside a transaction block is
 * only a WARNING in PostgreSQL, so the role change was silently dropped and
 * the queries kept running as the superuser, which BYPASSes RLS.
 *
 * A Proxy leaves the Prisma client itself untouched: the transaction client
 * stays pristine (and therefore transaction-aware), while the proxy only
 * redirects *reads* of model delegates / raw helpers to the scoped
 * transaction while a tenant scope is active.
 */
export type TenantScope = {
  organizationId: string;
  tx: Prisma.TransactionClient;
  /**
   * The raw helpers of the transaction, already bound to it.
   *
   * Prisma's raw helpers are plain methods that read `this._engine` (and
   * friends) to reach the connection. Calling them through the proxy would
   * give them the proxy as `this` — and the proxy resolves those internals
   * to the BASE client — so the statement would silently run outside the
   * transaction. Binding them to the transaction keeps them transaction-aware.
   */
  rawMethods: Map<string, (...args: any[]) => any>;
};

const TENANT_SCOPE = new AsyncLocalStorage<TenantScope>();

/** The tenant scope of the current async context, if any. */
export function getTenantScope(): TenantScope | undefined {
  return TENANT_SCOPE.getStore();
}

/** Raw helpers that must run on the scoped transaction client. */
const SCOPED_RAW_METHODS = new Set<string>([
  '$queryRaw',
  '$queryRawUnsafe',
  '$executeRaw',
  '$executeRawUnsafe',
  '$runCommandRaw',
]);

/**
 * Detects the model delegates (`client`, `deal`, `pipelineStage`, ...) of a
 * Prisma client. They are recognised by their shape (`findUnique` + `findMany`)
 * so the list never drifts from the schema.
 */
function detectModelDelegates(client: PrismaClient): Set<string> {
  const names = new Set<string>();
  for (const name of Object.getOwnPropertyNames(client)) {
    if (name.startsWith('$') || name.startsWith('_') || name === 'constructor') continue;
    const value = (client as unknown as Record<string, unknown>)[name];
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).findUnique === 'function' &&
      typeof (value as Record<string, unknown>).findMany === 'function'
    ) {
      names.add(name);
    }
  }
  return names;
}

export class PrismaService extends PrismaClient {
  private static instance: PrismaService;

  /** The original (unpatched) Prisma implementation of `$transaction`. */
  private readonly baseTransaction: PrismaClient['$transaction'];

  /** Names of the Prisma model delegates (`user`, `client`, `deal`, ...). */
  private readonly modelDelegateNames: Set<string>;

  private savepointSeq = 0;

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    const target = this;

    // Capture the original implementation BEFORE the proxy is installed.
    // Prisma binds `$transaction` as an own instance property, so it cannot
    // be reached through the prototype chain.
    this.baseTransaction = this.$transaction.bind(target) as PrismaClient['$transaction'];
    this.modelDelegateNames = detectModelDelegates(target);

    const modelDelegateNames = this.modelDelegateNames;
    const baseTransaction = this.baseTransaction;

    /**
     * `$transaction` while a tenant scope is active: the work runs inside
     * the request transaction, wrapped in a SAVEPOINT so a failure rolls back
     * only that block (leaving the outer transaction usable, exactly like a
     * standalone transaction would).
     */
    const scopedTransaction = (...args: any[]) => {
      const scope = TENANT_SCOPE.getStore();
      if (!scope) {
        return (baseTransaction as (...a: any[]) => Promise<unknown>)(...args);
      }

      const [arg] = args;

      if (typeof arg === 'function') {
        return target.runInSavepoint(scope.tx, () => arg(scope.tx));
      }

      // Array form: the operations were already created through the scoped
      // delegates, so awaiting them one by one runs them inside the request
      // transaction.
      return target.runInSavepoint(scope.tx, async () => {
        const results: unknown[] = [];
        for (const operation of arg as Array<PromiseLike<unknown>>) {
          results.push(await operation);
        }
        return results;
      });
    };

    const proxy = new Proxy(target, {
      get(obj, prop, receiver) {
        if (typeof prop !== 'string') {
          return Reflect.get(obj, prop, receiver);
        }

        const scope = TENANT_SCOPE.getStore();
        if (!scope) {
          return Reflect.get(obj, prop, receiver);
        }

        if (prop === '$transaction') {
          return scopedTransaction;
        }

        if (SCOPED_RAW_METHODS.has(prop)) {
          const scoped = scope.rawMethods.get(prop);
          if (scoped) return scoped;
        }

        if (modelDelegateNames.has(prop)) {
          const scoped = (scope.tx as unknown as Record<string, unknown>)[prop];
          if (scoped !== undefined) return scoped;
        }

        return Reflect.get(obj, prop, receiver);
      },
    });

    // Returning an object from a constructor replaces `this` for every
    // external reference: the DI container, the services and the module all
    // get the proxy, while Prisma's internals keep working on the real client.
    return proxy as PrismaService;
  }

  static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  /**
   * Runs `fn` inside a SAVEPOINT on the given transaction so a failure only
   * rolls back that block.
   */
  private async runInSavepoint<T>(tx: Prisma.TransactionClient, fn: () => Promise<T>): Promise<T> {
    this.savepointSeq += 1;
    const savepoint = `nexa_sp_${this.savepointSeq}`;

    await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
    try {
      const result = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      throw error;
    }
  }

  /**
   * Runs `fn` inside an interactive transaction bound to `organizationId`.
   *
   * The RLS context is set with `SET LOCAL`, so it is valid for exactly the
   * statements of that transaction and disappears with it. `fn` must resolve
   * when the request is done — the transaction stays open until then.
   */
  async runInTenantScope<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeoutMs?: number; maxWaitMs?: number },
  ): Promise<T> {
    const role = this.appRole;
    const timeout = options?.timeoutMs ?? 60_000;
    const maxWait = options?.maxWaitMs ?? 20_000;

    return this.baseTransaction(
      async (tx) => {
        // IMPORTANT: these MUST run through the transaction client. The
        // transaction client derives its members from the base client, so a
        // replacement on the base client would make these statements run on
        // the base connection — outside the transaction — where `SET LOCAL`
        // is only a warning and the RLS role change is silently lost.
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.organization_id', $1, true)`,
          organizationId,
        );

        // The raw helpers must stay bound to the transaction client.
        const rawMethods = new Map<string, (...args: any[]) => any>();
        for (const name of SCOPED_RAW_METHODS) {
          const method = (tx as unknown as Record<string, unknown>)[name];
          if (typeof method === 'function') {
            rawMethods.set(name, (method as (...a: any[]) => any).bind(tx));
          }
        }

        return TENANT_SCOPE.run({ organizationId, tx, rawMethods }, () => fn(tx));
      },
      { timeout, maxWait },
    );
  }

  /**
   * Rebinds the tenant of the current request (transaction scope). Used by
   * flows that start unauthenticated and only know the tenant later — e.g.
   * the OTP request, which writes into a tenant-scoped table.
   */
  async bindTenant(organizationId: string): Promise<void> {
    const scope = TENANT_SCOPE.getStore();
    if (scope) {
      await scope.tx.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, true)`,
        organizationId,
      );
      return;
    }

    // No request scope: bind inside a short-lived transaction of its own.
    await this.baseTransaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, true)`,
        organizationId,
      );
    });
  }

  private get appRole(): string {
    const role = process.env.RLS_APP_ROLE || 'nexa_app';
    // The role is interpolated into DDL-ish SQL, so it must be a plain
    // identifier — never anything else.
    if (!/^[a-z_][a-z0-9_]*$/i.test(role)) {
      throw new Error(`Invalid RLS_APP_ROLE: ${role}`);
    }
    return role;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    const tablenames = await this.$queryRaw<
      Array<{ tablename: string }>
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        try {
          await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
        } catch {
          // ignore
        }
      }
    }
  }
}
