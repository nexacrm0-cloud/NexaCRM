export interface OrganizationRepository {
  findById(id: string): Promise<OrganizationRecord | null>;
  findBySlug(slug: string): Promise<OrganizationRecord | null>;
  create(data: OrganizationCreateInput): Promise<OrganizationRecord>;
  update(id: string, data: Partial<OrganizationRecord>): Promise<OrganizationRecord>;
}

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationCreateInput = {
  name: string;
  slug: string;
  logo?: string | null;
  plan?: string;
};
