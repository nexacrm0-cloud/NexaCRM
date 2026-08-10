import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@nexa/shared';

@Injectable()
export class SupportGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // Only SUPER_ADMIN can use the support features
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Acceso restringido al personal de soporte');
    }

    // Handle Cross-Tenant Access: check if a specific organization is requested via header
    const supportOrgId = request.headers['x-support-org-id'];
    if (supportOrgId) {
      // We override the tenantId for the duration of the request
      request.organizationId = supportOrgId;
    }

    return true;
  }
}
