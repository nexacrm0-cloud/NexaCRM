export interface DealRepository {
  findById(id: string): Promise<DealRecord | null>;
  findByOrganization(organizationId: string, filters?: DealQueryFilters): Promise<DealRecord[]>;
  create(data: DealCreateInput): Promise<DealRecord>;
  update(id: string, data: Partial<DealRecord>): Promise<DealRecord>;
  moveStage(id: string, stageId: string): Promise<DealRecord>;
  delete(id: string): Promise<void>;
}

export type DealQueryFilters = {
  stageId?: string;
  search?: string;
};

export type DealRecord = {
  id: string;
  title: string;
  value: number;
  currency: string;
  probability: number;
  notes: string | null;
  closeDate: Date | null;
  lostReason: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  stageId: string;
  clientId: string | null;
  assignedTo: string | null;
};

export type DealCreateInput = {
  title: string;
  value?: number;
  currency?: string;
  probability?: number;
  notes?: string | null;
  closeDate?: Date | null;
  stageId: string;
  clientId?: string | null;
  assignedTo?: string | null;
  organizationId: string;
};
