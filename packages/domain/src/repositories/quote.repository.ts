export interface QuoteRepository {
  findById(id: string): Promise<QuoteRecord | null>;
  findByOrganization(
    organizationId: string,
    params?: QuoteQueryParams,
  ): Promise<{ data: QuoteRecord[]; total: number }>;
  create(data: QuoteCreateInput): Promise<QuoteRecord>;
  update(id: string, data: Partial<QuoteRecord>): Promise<QuoteRecord>;
  send(id: string): Promise<QuoteRecord>;
  accept(id: string): Promise<QuoteRecord>;
  reject(id: string, reason?: string): Promise<QuoteRecord>;
  delete(id: string): Promise<void>;
}

export type QuoteQueryParams = {
  status?: string;
  page?: number;
  limit?: number;
};

export type QuoteRecord = {
  id: string;
  number: string;
  title: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  validUntil: Date | null;
  pdfUrl: string | null;
  sentAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  clientId: string;
  dealId: string | null;
  createdById: string;
};

export type QuoteCreateInput = {
  number: string;
  title: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  validUntil?: Date | null;
  clientId: string;
  dealId?: string | null;
  createdById: string;
  organizationId: string;
};
