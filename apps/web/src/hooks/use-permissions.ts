import { UserRole } from '@nexa/shared';
import { useAuth } from './use-auth';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;

  return {
    isSuperAdmin: role === UserRole.SUPER_ADMIN,
    isOwner: role === UserRole.OWNER,
    isAdmin: role === UserRole.ADMIN || role === UserRole.OWNER || role === UserRole.SUPER_ADMIN,
    isMember: role !== UserRole.VIEWER,
    canCreate: role !== UserRole.VIEWER,
    canEdit: role !== UserRole.VIEWER,
    canDelete: role === UserRole.ADMIN || role === UserRole.OWNER || role === UserRole.SUPER_ADMIN,
    canManageTeam:
      role === UserRole.ADMIN || role === UserRole.OWNER || role === UserRole.SUPER_ADMIN,
    canManageSettings:
      role === UserRole.ADMIN || role === UserRole.OWNER || role === UserRole.SUPER_ADMIN,
  };
}
