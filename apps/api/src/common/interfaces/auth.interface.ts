import { UserRole } from '@nexa/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  organizationId: string;
  role: UserRole;
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
