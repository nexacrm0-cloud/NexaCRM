import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '@nexa/database';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Role the API process assumes for every request. Migrations/seeds use a
// different role (nexa_admin, with BYPASSRLS) via a separate DATABASE_URL.
// nexa_app has NOBYPASSRLS, so every query from the API is filtered by the
// Row Level Security policies installed by migration
// 20260808120000_enable_rls. The RLS policies compare
// current_setting('app.organization_id') against the table's "organizationId"
// column — so SETTING the role + the session var here is what makes RLS work.
//
// Why NOT SET LOCAL ROLE: SET LOCAL only survives until the end of the
// current transaction, but Prisma autocommits most queries outside an
// explicit $transaction — so the role would die before the first SELECT.
// SET ROLE (session scope) persists across queries on the same connection.
// We pair it with the RlsCleanupInterceptor, which runs RESET ROLE /
// RESET app.organization_id after the response is sent, so the pooled
// connection returns to the pool without leftover session state. The next
// request that reuses this connection will SET ROLE again here.
//
// Resolved inside use() rather than at module load so unit tests can flip
// process.env.RLS_APP_ROLE per-case and see the new value. Default role
// name matches the migration's CREATE ROLE statement.
const DEFAULT_APP_ROLE = 'nexa_app';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  private get appRole(): string {
    return process.env.RLS_APP_ROLE || DEFAULT_APP_ROLE;
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const user = (req as any).user;
    const supportOrgId = req.headers['x-support-org-id'];
    const isSupportRoute = req.originalUrl.startsWith('/api/v1/support');

    // SECURITY: the X-Support-Org-Id tenant override is ONLY honored on
    // /api/v1/support/* routes, never across the whole API. A SUPER_ADMIN
    // doing support must explicitly opt into the support sub-route. The
    // SupportGuard in those routes still validates the role and casts the
    // value via req.organizationId.
    const organizationId =
      user?.role === 'SUPER_ADMIN' && isSupportRoute && supportOrgId
        ? String(supportOrgId)
        : user?.organizationId;

    // Always assume the RLS-bound role for the rest of this connection's
    // request lifetime. This is the fail-closed mechanism: even if
    // organizationId is unset (e.g. /auth/login, /webhooks/*), the role
    // swap happens BEFORE we set the session var, so any query that runs
    // while app.organization_id is empty returns zero rows from tenant
    // tables — never leaks another tenant's data.
    //
    // We use two separate $executeRawUnsafe calls rather than a single
    // multi-statement string because Prisma's $executeRaw compiles the
    // SQL through pg's prepared-statement path, which only accepts one
    // statement per execute. The extra round trip is acceptable for a
    // per-request middleware.
    try {
      await this.prisma.$executeRawUnsafe(`SET ROLE ${this.appRole}`);
      // Always parameterize set_config with $1 — even the empty-string
      // case — so the SQL text is constant and only the bind value
      // changes. This makes observability/jest-assert simpler (the
      // second mock arg is always present) and avoids accidental SQL
      // injection if the "no user" branch ever carried user input.
      const orgIdToSet = organizationId && UUID_V4.test(organizationId) ? organizationId : '';
      if (organizationId && !UUID_V4.test(organizationId)) {
        this.logger.warn(`Rejected malformed organizationId in set_config: ${organizationId}`);
        // Use empty-string var: the role is already swapped, and the
        // policies treat `current_setting(...) = ''` as fail-closed
        // (no rows). We do NOT leave the var unset because some Query
        // paths might have run before the middleware and left a stale
        // value from the previous request — explicitly clearing here
        // gives a deterministic "no rows" regardless of pool state.
      }
      await this.prisma.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, false)`,
        orgIdToSet,
      );
    } catch (err: unknown) {
      // Role set_config failures are fatal under RLS: if we can't bound
      // the connection, ANY query that happens next would either run as
      // the unbound role (BYPASSRLS) or as nexa_app with no session var
      // (zero rows). The first leaks, the second breaks the request. We
      // fail the request instead of silently continuing — this surfaces
      // misconfiguration immediately rather than corrupting tenant
      // isolation.
      this.logger.error(
        'Failed to set RLS role/organization_id session variable; rejecting request',
        err instanceof Error ? err.message : err,
      );
      // Re-throw: Nest turns this into a 500, which is what we want — the
      // operator MUST see this surface, not a silent 200 with stale data.
      throw err;
    }

    next();
  }
}
