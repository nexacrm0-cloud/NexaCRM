export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findByOrganization(organizationId: string): Promise<UserRecord[]>;
  create(data: UserCreateInput): Promise<UserRecord>;
  update(id: string, data: Partial<UserRecord>): Promise<UserRecord>;
  delete(id: string): Promise<void>;
}

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  refreshToken: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
};

export type UserCreateInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role?: string;
  organizationId: string;
};
