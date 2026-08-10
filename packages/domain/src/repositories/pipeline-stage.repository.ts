export interface PipelineStageRepository {
  findByOrganization(organizationId: string): Promise<PipelineStageRecord[]>;
  findById(id: string): Promise<PipelineStageRecord | null>;
  create(data: PipelineStageCreateInput): Promise<PipelineStageRecord>;
  update(id: string, data: Partial<PipelineStageRecord>): Promise<PipelineStageRecord>;
  delete(id: string): Promise<void>;
}

export type PipelineStageRecord = {
  id: string;
  name: string;
  position: number;
  color: string;
  isWinStage: boolean;
  isLoseStage: boolean;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
};

export type PipelineStageCreateInput = {
  name: string;
  position: number;
  color?: string;
  isWinStage?: boolean;
  isLoseStage?: boolean;
  organizationId: string;
};
