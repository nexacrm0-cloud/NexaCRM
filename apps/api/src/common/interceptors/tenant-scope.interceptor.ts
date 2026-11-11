import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { PrismaService } from '@nexa/database';

// Organization.id is a TEXT column whose Prisma default is `cuid()` (a 'c'
// followed by 24 lowercase alphanumerics). Tenants imported from other
// systems may carry a canonical UUID instead. Both formats are accepted here;
// anything else is treated as malformed and leaves the RLS session var empty
// (fail-closed).
//
// NOTE: this must stay in sync with `model Organization.id` in
// packages/database/prisma/schema.prisma. Gating on UUID only made every
// cuid-based tenant invisible under RLS (every query returned zero rows).
const ORG_ID =
  /^(?:[a-z][a-z0-9]{23,24}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/**
 * Binds every authenticated request to its tenant for the WHOLE request.
 *
 * WHY AN INTERCEPTOR AND NOT A MIDDLEWARE
 * ---------------------------------------
 * Nest runs the request in this order: middleware -> guards -> interceptors
 * -> handler. The tenant is only known AFTER authentication (the JWT guard
 * resolves `req.user.organizationId`), so a middleware cannot bind it — it
 * runs too early and `req.user` is still undefined. Binding there silently
 * produced an EMPTY tenant context, which (because the API connects as a
 * superuser that BYPASSes RLS) let every query see every tenant's rows.
 *
 * The interceptor runs after the guards, so the tenant is known, and it wraps
 * the handler (pipes included) in the tenant transaction: the RLS context is
 * transaction-scoped (`SET LOCAL`), it is visible to every statement of the
 * request and Postgres discards it when the transaction ends.
 *
 * Requests without an authenticated user (login, webhooks, internal API-key
 * routes) keep the historical behaviour: no tenant to bind, so the queries
 * rely on their explicit `organizationId` filters.
 */
@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantScopeInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user?.organizationId) {
      // Unauthenticated route: nothing to bind.
      return next.handle();
    }

    const organizationId = this.resolveOrganizationId(request, user);

    return from(
      this.prisma.runInTenantScope(organizationId, async () =>
        // `next.handle()` is subscribed INSIDE the tenant scope, so the
        // handler — and every async continuation it starts — runs on the
        // tenant-bound connection.
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }

  /**
   * The tenant the request must run against.
   *
   * SECURITY: the X-Support-Org-Id tenant override is ONLY honored on
   * /api/v1/support/* routes and only for a SUPER_ADMIN. Everywhere else the
   * caller's own organization wins.
   */
  private resolveOrganizationId(request: any, user: any): string {
    const supportOrgId = request?.headers?.['x-support-org-id'];
    const isSupportRoute = String(request?.originalUrl || request?.url || '').startsWith(
      '/api/v1/support',
    );

    const raw =
      user.role === 'SUPER_ADMIN' && isSupportRoute && supportOrgId
        ? String(supportOrgId)
        : user.organizationId;

    if (!ORG_ID.test(raw)) {
      this.logger.warn(`Rejected malformed organizationId for the tenant scope: ${raw}`);
      // Fail closed: an empty tenant context makes the RLS policies hide
      // every tenant row instead of exposing another tenant's data.
      return '';
    }

    return raw;
  }
}
