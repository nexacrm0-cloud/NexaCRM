import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@nexa/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const req = context.switchToHttp().getRequest();
    const userRole = req.user?.role;
    // SECURITY L-17: do not leak user roles / paths to stdout. Only log
    // denials (where the analyst actually needs a trail) at debug level.
    if (!requiredRoles.includes(userRole)) {
      this.logger.warn(
        `Access denied: ${req.method} ${req.originalUrl} required=${requiredRoles.join(',')} role=${userRole ?? 'none'}`,
      );
      return false;
    }
    return true;
  }
}
