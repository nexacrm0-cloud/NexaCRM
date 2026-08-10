export interface TaskRepository {
  findById(id: string): Promise<TaskRecord | null>;
  findByOrganization(
    organizationId: string,
    params?: TaskQueryParams,
  ): Promise<{ data: TaskRecord[]; total: number }>;
  create(data: TaskCreateInput): Promise<TaskRecord>;
  update(id: string, data: Partial<TaskRecord>): Promise<TaskRecord>;
  complete(id: string): Promise<TaskRecord>;
  delete(id: string): Promise<void>;
}

export type TaskQueryParams = {
  status?: string;
  priority?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
};

export type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  reminderAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
  createdById: string;
  assignedTo: string | null;
  clientId: string | null;
  dealId: string | null;
};

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  priority?: string;
  status?: string;
  dueDate?: Date | null;
  reminderAt?: Date | null;
  assignedTo?: string | null;
  clientId?: string | null;
  dealId?: string | null;
  createdById: string;
  organizationId: string;
};
