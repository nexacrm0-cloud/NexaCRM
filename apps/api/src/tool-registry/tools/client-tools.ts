import { ToolDefinition, ToolContext, ToolResult } from '../tool.interface';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

type ToolFactory = (prisma: PrismaService, eventBus: EventBusService) => ToolDefinition;

async function findClientByName(prisma: PrismaService, name: string, organizationId: string) {
  return prisma.client.findFirst({
    where: {
      organizationId,
      OR: [
        { companyName: { contains: name, mode: 'insensitive' as const } },
        { contactName: { contains: name, mode: 'insensitive' as const } },
      ],
    },
  });
}

export const get_client_full_profile: ToolFactory = (prisma) => ({
  name: 'get_client_full_profile',
  displayName: 'Perfil Completo del Cliente',
  description: 'Obtener el perfil completo de un cliente con deals, tasks y quotes',
  category: 'CRUD',
  keywords: [
    'qué',
    'sabes',
    'del',
    'cliente',
    'perfil',
    'completo',
    'información',
    'todo',
    'sobre',
  ],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { clientName: { type: 'string' } },
    required: ['clientName'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const clientName = String(params.clientName ?? '').trim();
    if (!clientName) {
      return {
        success: false,
        error: 'Falta el parámetro "clientName"',
        naturalLanguage: '¿De qué cliente quieres el perfil?',
      };
    }
    const client = await prisma.client.findFirst({
      where: {
        organizationId: context.organizationId,
        OR: [
          { companyName: { contains: clientName, mode: 'insensitive' as const } },
          { contactName: { contains: clientName, mode: 'insensitive' as const } },
        ],
      },
      include: {
        deals: { include: { stage: true }, orderBy: { updatedAt: 'desc' } },
        tasks: { include: { assignee: true }, orderBy: { priority: 'desc' } },
        quotes: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) {
      return {
        success: false,
        error: `Cliente "${clientName}" no encontrado`,
        naturalLanguage: `No encontré ningún cliente llamado "${clientName}".`,
      };
    }
    return {
      success: true,
      data: client,
      naturalLanguage: `Perfil de ${client.companyName}: ${client.deals.length} oportunidades, ${client.tasks.length} tareas, ${client.quotes.length} presupuestos.`,
    };
  },
});

export const get_client_deals: ToolFactory = (prisma) => ({
  name: 'get_client_deals',
  displayName: 'Oportunidades del Cliente',
  description: 'Obtener las oportunidades (deals) de un cliente por nombre',
  category: 'CRUD',
  keywords: ['cómo', 'va', 'oportunidad', 'deals', 'negocios', 'oportunidades', 'del', 'cliente'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { clientName: { type: 'string' } },
    required: ['clientName'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const clientName = String(params.clientName ?? '').trim();
    if (!clientName) {
      return {
        success: false,
        error: 'Falta el parámetro "clientName"',
        naturalLanguage: '¿De qué cliente quieres ver las oportunidades?',
      };
    }
    const client = await findClientByName(prisma, clientName, context.organizationId);
    if (!client) {
      return {
        success: false,
        error: `Cliente "${clientName}" no encontrado`,
        naturalLanguage: `No encontré el cliente "${clientName}".`,
      };
    }
    const deals = await prisma.deal.findMany({
      where: { clientId: client.id, organizationId: context.organizationId },
      include: { stage: true },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      success: true,
      data: deals,
      naturalLanguage: `Oportunidades de ${client.companyName}: ${deals.length} deals registrados.`,
    };
  },
});

export const get_client_quotes: ToolFactory = (prisma) => ({
  name: 'get_client_quotes',
  displayName: 'Presupuestos del Cliente',
  description: 'Obtener los presupuestos (quotes) de un cliente por nombre',
  category: 'CRUD',
  keywords: ['presupuestos', 'cotizaciones', 'quotes', 'del', 'cliente', 'muéstrame'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { clientName: { type: 'string' } },
    required: ['clientName'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const clientName = String(params.clientName ?? '').trim();
    if (!clientName) {
      return {
        success: false,
        error: 'Falta el parámetro "clientName"',
        naturalLanguage: '¿De qué cliente quieres ver los presupuestos?',
      };
    }
    const client = await findClientByName(prisma, clientName, context.organizationId);
    if (!client) {
      return {
        success: false,
        error: `Cliente "${clientName}" no encontrado`,
        naturalLanguage: `No encontré el cliente "${clientName}".`,
      };
    }
    const quotes = await prisma.quote.findMany({
      where: { clientId: client.id, organizationId: context.organizationId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      success: true,
      data: quotes,
      naturalLanguage: `Presupuestos de ${client.companyName}: ${quotes.length} quotes.`,
    };
  },
});

export const get_client_tasks: ToolFactory = (prisma) => ({
  name: 'get_client_tasks',
  displayName: 'Tareas del Cliente',
  description: 'Obtener las tareas asociadas a un cliente por nombre',
  category: 'CRUD',
  keywords: ['tareas', 'tiene', 'del', 'cliente', 'pending', 'pendientes', 'de'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { clientName: { type: 'string' } },
    required: ['clientName'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const clientName = String(params.clientName ?? '').trim();
    if (!clientName) {
      return {
        success: false,
        error: 'Falta el parámetro "clientName"',
        naturalLanguage: '¿De qué cliente quieres ver las tareas?',
      };
    }
    const client = await findClientByName(prisma, clientName, context.organizationId);
    if (!client) {
      return {
        success: false,
        error: `Cliente "${clientName}" no encontrado`,
        naturalLanguage: `No encontré el cliente "${clientName}".`,
      };
    }
    const tasks = await prisma.task.findMany({
      where: { clientId: client.id, organizationId: context.organizationId },
      include: { assignee: true },
      orderBy: { priority: 'desc' },
    });
    return {
      success: true,
      data: tasks,
      naturalLanguage: `Tareas de ${client.companyName}: ${tasks.length} tareas.`,
    };
  },
});

export const get_unanswered_quotes: ToolFactory = (prisma) => ({
  name: 'get_unanswered_quotes',
  displayName: 'Presupuestos Sin Respuesta',
  description: 'Obtener presupuestos enviados sin respuesta del cliente',
  category: 'CRUD',
  keywords: [
    'presupuestos',
    'cotizaciones',
    'sin',
    'respuesta',
    'responder',
    'unanswered',
    'pendientes',
  ],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const quotes = await prisma.quote.findMany({
      where: {
        organizationId: context.organizationId,
        status: 'SENT',
        sentAt: { not: null },
        acceptedAt: null,
        rejectedAt: null,
      },
      include: { client: true },
      orderBy: { sentAt: 'desc' },
    });
    return {
      success: true,
      data: { quotes, count: quotes.length },
      naturalLanguage: `Hay ${quotes.length} presupuestos enviados sin respuesta.`,
    };
  },
});

export const get_overdue_tasks: ToolFactory = (prisma) => ({
  name: 'get_overdue_tasks',
  displayName: 'Tareas Vencidas',
  description: 'Obtener tareas vencidas (dueDate en el pasado y sin completar)',
  category: 'CRUD',
  keywords: ['tareas', 'vencidas', 'atrasadas', 'overdue', 'vencieron', 'están'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const now = new Date();
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: context.organizationId,
        dueDate: { lt: now },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: { assignee: true, client: true },
      orderBy: { dueDate: 'asc' },
    });
    return {
      success: true,
      data: { tasks, count: tasks.length },
      naturalLanguage: `Hay ${tasks.length} tareas vencidas.`,
    };
  },
});

export const get_client_health: ToolFactory = (prisma) => ({
  name: 'get_client_health',
  displayName: 'Salud del Cliente',
  description: 'Evaluar la salud/riesgo de abandono de los clientes',
  category: 'AI',
  keywords: ['salud', 'client', 'health', 'riesgo', 'abandono', 'churn', 'en', 'riesgo'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const atRisk = await prisma.client.findMany({
      where: {
        organizationId: context.organizationId,
        deals: { none: { updatedAt: { gte: cutoff } } },
      },
      include: { deals: true, tasks: true },
    });
    return {
      success: true,
      data: { atRisk, count: atRisk.length },
      naturalLanguage: `Hay ${atRisk.length} clientes en riesgo (sin actividad comercial en 90+ días).`,
    };
  },
});

export const clientTools: ToolFactory[] = [
  get_client_full_profile,
  get_client_deals,
  get_client_quotes,
  get_client_tasks,
  get_unanswered_quotes,
  get_overdue_tasks,
  get_client_health,
];
