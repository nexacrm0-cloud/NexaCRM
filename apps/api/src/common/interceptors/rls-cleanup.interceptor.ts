import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PrismaService } from '@nexa/database';

// Cleanup paired with TenantMiddleware.
//
// TenantMiddleware sets `SET ROLE nexa_app` + `set_config('app.organization_id',
// $1, false)` (both session-scoped) on the pooled Postgres connection the
// request will use. RLS policies on tenant tables then filter those queries
// by the session var.
//
// Session scope means the role/var STICK on the connection after the response
// is sent — they don't expire when the response finishes. Prisma's connection
// pool reuses this connection for the NEXT request, which might:
//   - be a request from a different tenant (relative to the same pool entry),
//   - be a request that doesn't go through TenantMiddleware (edge case),
//   - be a future $transaction or raw query that expects the default role.
//
// To stop tenant A's session var from leaking into tenant B's request, this
// interceptor runs RESET ROLE + RESET app.organization_id in finalize —
// which RxJS guarantees runs AFTER the response stream completes, success OR
// error. The connection returns to the pool as if it had never been used,
// so the next TenantMiddleware invocation can set fresh values without
// inheriting the previous tenant's state.
//
// Failure to reset here is NOT catastrophic on its own: TenantMiddleware
// overwrites both values on every request, so even absent cleanup the var is
// rewritten on the next request. The reset is defense-in-depth against:
//   1. Pool reuse races where a connection is reused before TenantMiddleware
//      runs (e.g. between Nest middleware resolution and the first Prisma
//      query of the next request).
//   2. Background jobs / scheduled tasks that use Prisma directly without
//      going through HTTP middleware (ScheduledAgentService, cleanup
//      services). Those should set their own role/var, but if they don't,
//      the previous tenant's value shouldn't leak through.
//   3. A future refactor that removes TenantMiddleware from a route by
//      accident — without this reset, that route would inherit the
//      previous request's tenant bound on the same pool slot.

@Injectable()
export class RlsCleanupInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RlsCleanupInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      finalize(async () => {
        try {
          // RESET ROLE puts the connection back to the role it had at CONNECT
          // time (i.e. the role named in DATABASE_URL — which, in prod, is
          // nexa_admin's MEMBER-compatible role that can SET ROLE into
          // nexa_app). Without this, the connection would stay as nexa_app
          // across requests, which would actually be fine under RLS but
          // would prevent any internal-only code path from temporarily
          // escalating (e.g. for migrations invoked through a long-lived
          // connection, which we explicitly want to discourage).
          await this.prisma.$executeRawUnsafe(`RESET ROLE`);
          await this.prisma.$executeRawUnsafe(`RESET app.organization_id`);
        } catch (err: unknown) {
          // Log but never throw — finalize errors would otherwise mask the
          // real response. A failed reset is a soft warning: the next
          // request's TenantMiddleware will overwrite the values anyway.
          this.logger.warn(
            'Failed to RESET ROLE / RESET app.organization_id after request',
            err instanceof Error ? err.message : err,
          );
        }
      }),
    );
  }
}
