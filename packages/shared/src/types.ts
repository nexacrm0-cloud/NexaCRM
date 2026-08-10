import type {
  UserRole,
  DealStatus,
  TaskPriority,
  TaskStatus,
  QuoteStatus,
  ActivityType,
  InvoiceStatus,
  InvoiceType,
  EventType,
  WorkflowActionType,
  WorkflowExecutionStatus,
} from './enums';
import type { WorkflowAction } from './automation';

export type PaginationParams = {
  page?: number;
  limit?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
  organizationId: string;
  role: UserRole;
};

export type OrganizationPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  onboardingCompleted?: boolean;
};

export type ClientData = {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineStageData = {
  id: string;
  name: string;
  position: number;
  color: string;
  isWinStage: boolean;
  isLoseStage: boolean;
};

export type DealData = {
  id: string;
  title: string;
  value: number;
  currency: string;
  probability: number;
  notes: string | null;
  closeDate: string | null;
  lostReason: string | null;
  stageId: string;
  stageName: string;
  stageColor: string;
  clientId: string | null;
  clientName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
};

export type TaskData = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  reminderAt: string | null;
  completedAt: string | null;
  createdById: string;
  assignedTo: string | null;
  assigneeName: string | null;
  clientId: string | null;
  clientName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  createdAt: string;
};

export type QuoteItemData = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type QuoteData = {
  id: string;
  number: string;
  title: string;
  status: QuoteStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  validUntil: string | null;
  pdfUrl: string | null;
  sentAt: string | null;
  clientId: string;
  clientName: string;
  clientCompany: string;
  createdById: string;
  createdByName: string;
  items: QuoteItemData[];
  createdAt: string;
};

export type ActivityLogData = {
  id: string;
  type: ActivityType;
  description: string;
  metadata: unknown | null;
  userId: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
};

export type DashboardSummary = {
  monthlySales: number;
  newClients: number;
  openOpportunities: number;
  pendingTasks: number;
  recentActivity: ActivityLogData[];
  aiSummary: string | null;
};

export type CommandPaletteResult = {
  intent: string;
  action: string;
  parameters: Record<string, unknown>;
  naturalLanguage: string;
};

export type EventData = {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string | null;
  location: string | null;
  clientId: string | null;
  clientName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  taskId: string | null;
  taskTitle: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
};

export type InvoiceItemData = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceData = {
  id: string;
  title: string | null;
  number: string;
  invoiceType: InvoiceType;
  pointOfSale: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  cuit: string | null;
  ivaCondition: string | null;
  cae: string | null;
  caeExpiresAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  clientId: string;
  clientName: string;
  clientCompany: string;
  quoteId: string | null;
  createdById: string;
  createdByName: string;
  items: InvoiceItemData[];
  createdAt: string;
};

export type Workflow = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerConfig: Record<string, any>;
  conditions: Record<string, any> | null;
  actions: WorkflowAction[];
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  createdById: string;
};

export type WorkflowExecutionLog = {
  id: string;
  status: WorkflowExecutionStatus;
  triggerType: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
  organizationId: string;
  workflowId: string;
};
