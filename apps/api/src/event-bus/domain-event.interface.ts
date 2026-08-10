export interface DomainEvent {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  metadata: {
    organizationId: string;
    userId: string;
    correlationId: string;
    timestamp: Date;
  };
}
