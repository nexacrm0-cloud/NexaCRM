export { Email } from './email.vo';
export { Phone } from './phone.vo';
export { Money, type Currency } from './money.vo';
export { Address } from './address.vo';
export { Slug } from './slug.vo';
export { Percentage } from './percentage.vo';

export { EventNames } from './events/event-names';
export type { EventName } from './events/event-names';
export type {
  DomainEvent,
  DomainEventMetadata,
  EventPayloadMap,
  ClientPayload,
  DealPayload,
  DealMovedPayload,
  TaskPayload,
  QuotePayload,
  OrganizationPayload,
  UserPayload,
} from './events/event-payloads';

export type {
  OrganizationRepository,
  OrganizationRecord,
  OrganizationCreateInput,
  UserRepository,
  UserRecord,
  UserCreateInput,
  ClientRepository,
  ClientRecord,
  ClientCreateInput,
  ClientQueryParams,
  DealRepository,
  DealRecord,
  DealCreateInput,
  DealQueryFilters,
  TaskRepository,
  TaskRecord,
  TaskCreateInput,
  TaskQueryParams,
  QuoteRepository,
  QuoteRecord,
  QuoteCreateInput,
  QuoteQueryParams,
  PipelineStageRepository,
  PipelineStageRecord,
  PipelineStageCreateInput,
} from './repositories';
