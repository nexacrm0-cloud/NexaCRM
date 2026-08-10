export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum DealStatus {
  LEAD = 'LEAD',
  CONTACTED = 'CONTACTED',
  MEETING = 'MEETING',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum ActivityType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  NOTE_ADDED = 'NOTE_ADDED',
  FILE_ATTACHED = 'FILE_ATTACHED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  EMAIL_SENT = 'EMAIL_SENT',
  CALL_MADE = 'CALL_MADE',
  MEETING_SCHEDULED = 'MEETING_SCHEDULED',
  QUOTE_GENERATED = 'QUOTE_GENERATED',
  DEAL_WON = 'DEAL_WON',
  DEAL_LOST = 'DEAL_LOST',
  INVOICE_ISSUED = 'INVOICE_ISSUED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceType {
  A = 'A',
  B = 'B',
  C = 'C',
  E = 'E',
  M = 'M',
}

export enum EventType {
  MEETING = 'MEETING',
  CALL = 'CALL',
  TASK = 'TASK',
  REMINDER = 'REMINDER',
  OTHER = 'OTHER',
}

export enum ConnectorType {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  GOOGLE_CALENDAR = 'google_calendar',
  SLACK = 'slack',
  TEAMS = 'teams',
  STRIPE = 'stripe',
  MERCADO_PAGO = 'mercado_pago',
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  GOOGLE_SHEETS = 'google_sheets',
  WEBHOOK = 'webhook',
}

export enum WorkflowActionType {
  CREATE_TASK = 'create_task',
  MOVE_DEAL = 'move_deal',
  SEND_EMAIL = 'send_email',
  SEND_WHATSAPP = 'send_whatsapp',
  NOTIFY_TEAM = 'notify_team',
  UPDATE_DEAL = 'update_deal',
  WEBHOOK = 'webhook',
}

export enum WorkflowExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AgentType {
  SALES = 'sales',
  FOLLOW_UP = 'follow_up',
  BUSINESS_ANALYST = 'business_analyst',
  OPERATIONS = 'operations',
  WHATSAPP_AI = 'whatsapp_ai',
}

export enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum CompanySize {
  SME = 'SME',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SupportStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING_RENEWAL = 'PENDING_RENEWAL',
  SUSPENDED = 'SUSPENDED',
}
