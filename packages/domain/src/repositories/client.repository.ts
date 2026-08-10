export interface ClientRepository {
  findById(id: string): Promise<ClientRecord | null>;
  findByOrganization(
    organizationId: string,
    params?: ClientQueryParams,
  ): Promise<{ data: ClientRecord[]; total: number }>;
  create(data: ClientCreateInput): Promise<ClientRecord>;
  update(id: string, data: Partial<ClientRecord>): Promise<ClientRecord>;
  delete(id: string): Promise<void>;
}

export type ClientQueryParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type ClientRecord = {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
};

export type ClientCreateInput = {
  companyName: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tags?: string[];
  notes?: string | null;
  organizationId: string;
};
