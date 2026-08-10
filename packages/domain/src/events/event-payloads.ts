export type DomainEventMetadata = {
  organizationId: string;
  userId: string;
  correlationId: string;
  timestamp: Date;
};

export type ClientPayload = {
  clientId: string;
  companyName: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
};

export type DealPayload = {
  dealId: string;
  title: string;
  value: number;
  stageId: string;
  stageName: string;
  clientId?: string | null;
};

export type TaskPayload = {
  taskId: string;
  title: string;
  status: string;
  assignedTo?: string | null;
  clientId?: string | null;
  dealId?: string | null;
};

export type QuotePayload = {
  quoteId: string;
  number: string;
  total: number;
  clientId: string;
  status: string;
};

export type OrganizationPayload = {
  organizationId: string;
  name: string;
  slug: string;
};

export type UserPayload = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type DealMovedPayload = DealPayload & { previousStageName: string };

export interface EventPayloadMap {
  'client.created': ClientPayload;
  'client.updated': ClientPayload;
  'client.deleted': Pick<ClientPayload, 'clientId' | 'companyName'>;
  'deal.created': DealPayload;
  'deal.updated': DealPayload;
  'deal.moved': DealMovedPayload;
  'deal.deleted': Pick<DealPayload, 'dealId' | 'title'>;
  'task.created': TaskPayload;
  'task.updated': TaskPayload;
  'task.completed': Pick<TaskPayload, 'taskId' | 'title'>;
  'task.deleted': Pick<TaskPayload, 'taskId' | 'title'>;
  'quote.created': QuotePayload;
  'quote.updated': Partial<QuotePayload>;
  'quote.sent': QuotePayload;
  'quote.accepted': Pick<QuotePayload, 'quoteId' | 'number' | 'clientId'>;
  'quote.rejected': Pick<QuotePayload, 'quoteId' | 'number' | 'clientId'> & { reason?: string };
  'quote.deleted': Pick<QuotePayload, 'quoteId' | 'number'>;
  'organization.created': OrganizationPayload;
  'user.created': UserPayload;
  'user.updated': Partial<UserPayload>;
}

export type DomainEvent<T extends string = string> = {
  eventName: T;
  aggregateType: string;
  aggregateId: string;
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : Record<string, unknown>;
  metadata: DomainEventMetadata;
};
