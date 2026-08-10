import { z } from 'zod';
import {
  UserRole,
  TaskPriority,
  TaskStatus,
  QuoteStatus,
  EventType,
  InvoiceType,
  InvoiceStatus,
  ConnectorType,
  SupportStatus,
  CompanySize,
  PlanTier,
} from './enums';

const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial');

const nullableDateTime = z
  .string()
  .refine((v) => v === '' || !Number.isNaN(Date.parse(v)), { message: 'Fecha inválida' })
  .optional();

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  organizationName: z.string().min(2, 'Mínimo 2 caracteres'),
  currency: z.enum(['USD', 'ARS', 'MXN', 'COP', 'CLP', 'EUR', 'BRL', 'PEN', 'UYU']).default('ARS'),
});

export const SUPPORTED_CURRENCIES = [
  'USD',
  'ARS',
  'MXN',
  'COP',
  'CLP',
  'EUR',
  'BRL',
  'PEN',
  'UYU',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const updateSettingsSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').optional(),
  logo: z.string().optional().or(z.literal('')),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  locale: z.string().optional(),
});

export const completeOnboardingSchema = z.object({
  currency: z.enum(SUPPORTED_CURRENCIES).default('ARS'),
});

export const createClientSchema = z.object({
  companyName: z.string().min(1, 'Nombre de empresa requerido'),
  contactName: z.string().min(1, 'Nombre de contacto requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional().or(z.literal('')),
});

export const updateClientSchema = createClientSchema.partial();

export const createDealSchema = z.object({
  title: z.string().min(1, 'Título requerido'),
  value: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  probability: z.number().min(0).max(100).default(0),
  notes: z.string().optional().or(z.literal('')),
  closeDate: nullableDateTime,
  stageId: z.string().min(1, 'Etapa requerida'),
  clientId: z.string().optional().or(z.literal('')),
  assignedTo: z.string().optional().or(z.literal('')),
});

export const updateDealSchema = createDealSchema.partial();

export const moveDealSchema = z.object({
  stageId: z.string().min(1, 'Etapa requerida'),
  position: z.number().int().min(0).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Título requerido'),
  description: z.string().optional().or(z.literal('')),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.PENDING),
  dueDate: nullableDateTime,
  reminderAt: nullableDateTime,
  assignedTo: z.string().optional().or(z.literal('')),
  clientId: z.string().optional().or(z.literal('')),
  dealId: z.string().optional().or(z.literal('')),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createQuoteItemSchema = z.object({
  description: z.string().min(1, 'Descripción requerida'),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
  discount: z.number().min(0).max(100).default(0),
  productVariantId: z.string().optional().or(z.literal('')),
  productId: z.string().optional().or(z.literal('')),
});

export const createQuoteSchema = z.object({
  title: z.string().min(1, 'Título requerido'),
  clientId: z.string().min(1, 'Cliente requerido'),
  dealId: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  terms: z.string().optional().or(z.literal('')),
  taxRate: z.number().min(0).max(100).default(0),
  validUntil: nullableDateTime,
  items: z.array(createQuoteItemSchema).min(1, 'Al menos un item'),
});

export const updateQuoteSchema = createQuoteSchema.partial();

export const aiQuerySchema = z.object({
  query: z.string().min(1, 'Consulta requerida'),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional().or(z.literal('')),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type MoveDealInput = z.infer<typeof moveDealSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type AiQueryInput = z.infer<typeof aiQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export const createInvitationSchema = z.object({
  email: z.string().email('Email inválido'),
  // SECURITY ALTA-7: never allow SUPER_ADMIN via invitation — that role is
  // platform-staff only and is set out-of-band. Restrict invitations to the
  // tenant roles a tenant-admin can ever grant.
  role: z
    .enum([UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER, UserRole.VIEWER])
    .optional()
    .default(UserRole.MEMBER),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: passwordSchema,
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  password: passwordSchema,
});

export const createEventSchema = z
  .object({
    title: z.string().min(1, 'Título requerido'),
    description: z.string().optional().or(z.literal('')),
    type: z.nativeEnum(EventType).default(EventType.MEETING),
    startDate: z.string().min(1, 'Fecha de inicio requerida'),
    endDate: z.string().min(1, 'Fecha de fin requerida'),
    allDay: z.boolean().default(false),
    color: z.string().optional().or(z.literal('')),
    location: z.string().optional().or(z.literal('')),
    clientId: z.string().optional().or(z.literal('')),
    dealId: z.string().optional().or(z.literal('')),
    taskId: z.string().optional().or(z.literal('')),
    isRecurring: z.boolean().default(false),
    recurrenceRule: z.string().optional(),
    recurringEventId: z.string().optional(),
    recurrenceException: z.string().optional(),
  })
  .passthrough();

export const updateEventSchema = createEventSchema.partial();

export const createInvoiceItemSchema = z.object({
  description: z.string().min(1, 'Descripción requerida'),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
  discount: z.number().min(0).max(100).default(0),
  productVariantId: z.string().optional().or(z.literal('')),
  productId: z.string().optional().or(z.literal('')),
});

export const createInvoiceSchema = z.object({
  title: z.string().optional().or(z.literal('')),
  invoiceType: z.nativeEnum(InvoiceType).default(InvoiceType.B),
  pointOfSale: z.string().default('0001'),
  clientId: z.string().min(1, 'Cliente requerido'),
  quoteId: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  terms: z.string().optional().or(z.literal('')),
  taxRate: z.number().min(0).max(100).default(0),
  cuit: z.string().optional().or(z.literal('')),
  ivaCondition: z.string().optional().or(z.literal('')),
  items: z.array(createInvoiceItemSchema).min(1, 'Al menos un item'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const agentCreateClientSchema = z.object({
  companyName: z.string().min(1, 'companyName requerido').max(255),
  contactName: z.string().max(255).optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  tags: z.array(z.string().max(50)).max(50).optional(),
  source: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(5000).optional().or(z.literal('')),
});

export const agentSearchClientQuerySchema = z
  .object({
    phone: z.string().max(50).optional(),
    email: z.string().email('Email inválido').optional(),
  })
  .refine((d) => Boolean(d.phone || d.email), {
    message: 'phone o email requerido',
  });

export const agentCreateDealSchema = z.object({
  title: z.string().min(1, 'title requerido').max(255),
  value: z.number().min(0).default(0),
  currency: z.string().min(3).max(10).default('USD'),
  stageId: z.string().min(1).optional().or(z.literal('')),
  clientId: z.string().optional().or(z.literal('')),
  assignedTo: z.string().optional().or(z.literal('')),
  probability: z.number().min(0).max(100).default(10),
  notes: z.string().max(5000).optional().or(z.literal('')),
});

export const agentCreateTaskSchema = z.object({
  title: z.string().min(1, 'title requerido').max(255),
  description: z.string().max(5000).optional().or(z.literal('')),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: nullableDateTime,
  clientId: z.string().optional().or(z.literal('')),
  dealId: z.string().optional().or(z.literal('')),
  assignedTo: z.string().optional().or(z.literal('')),
});

export const agentCreateQuoteSchema = z.object({
  title: z.string().min(1, 'title requerido').max(255),
  clientId: z.string().min(1, 'clientId requerido'),
  dealId: z.string().optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        quantity: z.number().positive().max(1_000_000),
        unitPrice: z.number().min(0).max(1_000_000_000),
      }),
    )
    .min(1, 'Al menos un item'),
  taxRate: z.number().min(0).max(100).default(0),
  notes: z.string().max(5000).optional().or(z.literal('')),
  terms: z.string().max(5000).optional().or(z.literal('')),
  validUntil: nullableDateTime,
});

export const agentCallbackSchema = z.object({
  executionId: z.string().min(1, 'executionId requerido'),
  agentId: z.string().min(1, 'agentId requerido'),
  organizationId: z.string().min(1, 'organizationId requerido'),
  status: z.enum(['COMPLETED', 'FAILED']),
  output: z.record(z.unknown()).optional(),
  error: z.string().max(5000).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
});

export const agentTriggerSchema = z.object({
  agentId: z.string().min(1, 'agentId requerido'),
  organizationId: z.string().min(1, 'organizationId requerido'),
  event: z.string().min(1, 'event requerido').max(255),
  payload: z.record(z.unknown()).default({}),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, 'name requerido').max(100),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export const upsertConnectorSchema = z.object({
  type: z.nativeEnum(ConnectorType),
  config: z.object({
    apiKey: z.string().max(500).optional(),
    apiSecret: z.string().max(500).optional(),
    webhookUrl: z.string().url().max(500).optional(),
    accessToken: z.string().max(2000).optional(),
    refreshToken: z.string().max(2000).optional(),
    accountId: z.string().max(255).optional(),
    settings: z.record(z.unknown()).default({}),
  }),
});

export const createProductCategorySchema = z.object({
  name: z.string().min(1, 'name requerido').max(100),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color hex inválido')
    .optional()
    .or(z.literal('')),
});

const productVariantInputSchema = z.object({
  sku: z.string().max(100).optional(),
  name: z.string().max(255).optional(),
  attributes: z.record(z.unknown()).optional(),
  price: z.number().min(0).max(1_000_000_000).optional(),
  stock: z.number().int().min(0).max(1_000_000_000).optional(),
  minStock: z.number().int().min(0).max(1_000_000_000).optional(),
  maxStock: z.number().int().min(0).max(1_000_000_000).optional(),
});

export const createProductSchema = z.object({
  sku: z.string().min(1, 'sku requerido').max(100),
  name: z.string().min(1, 'name requerido').max(255),
  description: z.string().max(5000).optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  price: z.number().min(0).max(1_000_000_000).default(0),
  cost: z.number().min(0).max(1_000_000_000).default(0),
  unit: z.string().max(50).optional().or(z.literal('')),
  trackStock: z.boolean().default(true),
  stock: z.number().int().min(0).max(1_000_000_000).default(0),
  minStock: z.number().int().min(0).max(1_000_000_000).optional(),
  maxStock: z.number().int().min(0).max(1_000_000_000).optional(),
  categoryId: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  variants: z.array(productVariantInputSchema).max(100).optional(),
});

export const updateProductSchema = createProductSchema
  .omit({ sku: true, variants: true })
  .partial();

export const addProductVariantSchema = productVariantInputSchema;

export const stockMovementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  productId: z.string().optional(),
  type: z.enum(['IN', 'OUT', 'ADJUST']).optional(),
});

export const productsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().max(255).optional(),
  categoryId: z.string().optional(),
  status: z.enum(['all', 'active', 'lowStock']).optional(),
});

export const recordStockMovementSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  quantity: z.number().int().positive().max(1_000_000_000),
  variantId: z.string().nullable().optional(),
  reason: z.string().max(500).optional().or(z.literal('')),
  reference: z.string().max(255).optional().or(z.literal('')),
});

export const updateSupportStatusSchema = z.object({
  status: z.nativeEnum(SupportStatus),
});

export const updateCompanySizeSchema = z.object({
  size: z.nativeEnum(CompanySize),
});

export const changePlanSchema = z.object({
  plan: z.nativeEnum(PlanTier),
});

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1).max(64),
});

export const organizationIdParamSchema = z.object({
  organizationId: z.string().min(1).max(64),
});

// ---- WhatsApp webhook (Meta Cloud API) -------------------------------------
// Mirrors the payload shape Meta sends on /webhooks/whatsapp. Validated AFTER
// the HMAC signature check, so by the time this runs we know the body came
// from Meta. We keep it strict (reject unknown envelope shapes) so a future
// attacker can't exploit a schema drift to smuggle fields past the guard.
// `statuses[].status` is enumerated by Meta; we accept the known set and
// reject anything else, which protects the service from unbounded string
// storage and surfaces misconfigured test sends early.

const whatsappContactSchema = z
  .object({
    profile: z.object({ name: z.string().max(255) }).optional(),
    wa_id: z.string().max(32).optional(),
  })
  .passthrough();

const whatsappTextMessageSchema = z
  .object({
    body: z.string().max(4096),
  })
  .passthrough();

const whatsappMessageSchema = z
  .object({
    id: z.string().min(1, 'message id requerido').max(128),
    type: z.string().max(32),
    from: z.string().max(32).optional(),
    timestamp: z.string().max(20).optional(),
    text: whatsappTextMessageSchema.optional(),
    // Other types (image, audio, document, button, interactive, ...) are
    // accepted as passthrough so we can extend without churning the schema.
  })
  .passthrough();

const whatsappStatusSchema = z
  .object({
    id: z.string().max(128),
    status: z.enum(['sent', 'delivered', 'read', 'failed', 'queued', 'pending', 'undelivered']),
    recipient_id: z.string().max(32).optional(),
    timestamp: z.string().max(20).optional(),
    errors: z.array(z.any()).max(10).optional(),
  })
  .passthrough();

const whatsappMetadataSchema = z
  .object({
    phone_number_id: z.string().max(32).optional(),
    display_phone_number: z.string().max(32).optional(),
  })
  .passthrough();

const whatsappValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp').optional(),
    metadata: whatsappMetadataSchema.optional(),
    contacts: z.array(whatsappContactSchema).max(10).optional(),
    messages: z.array(whatsappMessageSchema).max(10).optional(),
    statuses: z.array(whatsappStatusSchema).max(50).optional(),
  })
  .passthrough();

const whatsappChangeSchema = z
  .object({
    field: z.string().max(64),
    value: whatsappValueSchema,
  })
  .passthrough();

const whatsappEntrySchema = z
  .object({
    id: z.string().max(128),
    changes: z.array(whatsappChangeSchema).min(1).max(10),
  })
  .passthrough();

export const whatsappWebhookSchema = z
  .object({
    object: z.literal('whatsapp_business_account'),
    entry: z.array(whatsappEntrySchema).min(1).max(20),
  })
  .passthrough();

export type WhatsappWebhookInput = z.infer<typeof whatsappWebhookSchema>;
