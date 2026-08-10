import { ToolDefinition, ToolContext, ToolResult } from '../tool.interface';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

type ToolFactory = (prisma: PrismaService, eventBus: EventBusService) => ToolDefinition;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es')}`;
}

export const get_monthly_sales: ToolFactory = (prisma) => ({
  name: 'get_monthly_sales',
  displayName: 'Ventas del Mes',
  description: 'Obtener el total de ventas del mes actual',
  category: 'CRUD',
  keywords: ['ventas', 'mes', 'monthly', 'sales', 'facturación', 'vendimos', 'facturamos'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const projection = await prisma.dashboardProjection.findUnique({
      where: { organizationId: context.organizationId },
    });
    const monthlySales = Number(projection?.monthlySales ?? 0);
    return {
      success: true,
      data: { monthlySales },
      naturalLanguage: `Este mes facturaste ${formatCurrency(monthlySales)}.`,
    };
  },
});

export const get_open_opportunities: ToolFactory = (prisma) => ({
  name: 'get_open_opportunities',
  displayName: 'Oportunidades Abiertas',
  description: 'Obtener oportunidades abiertas en el pipeline',
  category: 'CRUD',
  keywords: ['oportunidades', 'abiertas', 'pipeline', 'negocios', 'deals', 'activos'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const deals = await prisma.deal.findMany({
      where: {
        organizationId: context.organizationId,
        stage: { isWinStage: false, isLoseStage: false },
      },
      include: { stage: true, client: true },
      orderBy: { position: 'asc' },
    });
    const total = deals.reduce((sum, d) => sum + Number(d.value), 0);
    return {
      success: true,
      data: { deals, count: deals.length, totalValue: total },
      naturalLanguage: `Tienes ${deals.length} oportunidades abiertas por un valor total de ${formatCurrency(total)}.`,
    };
  },
});

export const get_stale_opportunities: ToolFactory = (prisma) => ({
  name: 'get_stale_opportunities',
  displayName: 'Oportunidades Inactivas',
  description: 'Obtener oportunidades con más de 20 días sin actividad',
  category: 'CRUD',
  keywords: ['inactivas', 'sin actividad', 'días sin', 'estancadas', 'stale', 'oportunidades'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const cutoff = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const deals = await prisma.deal.findMany({
      where: {
        organizationId: context.organizationId,
        updatedAt: { lt: cutoff },
        stage: { isWinStage: false, isLoseStage: false },
      },
      include: { stage: true, client: true },
    });
    return {
      success: true,
      data: { deals, count: deals.length },
      naturalLanguage: `Hay ${deals.length} oportunidades inactivas (sin actividad en 20+ días).`,
    };
  },
});

export const get_inactive_clients: ToolFactory = (prisma) => ({
  name: 'get_inactive_clients',
  displayName: 'Clientes Inactivos',
  description: 'Obtener clientes que no han comprado en más de 60 días',
  category: 'CRUD',
  keywords: ['clientes', 'inactivos', 'sin compra', 'no compran', 'inactive'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const clients = await prisma.client.findMany({
      where: {
        organizationId: context.organizationId,
        deals: { none: { updatedAt: { gte: cutoff } } },
      },
    });
    return {
      success: true,
      data: { clients, count: clients.length },
      naturalLanguage: `Hay ${clients.length} clientes inactivos (sin compra en 60+ días).`,
    };
  },
});

export const get_pending_tasks: ToolFactory = (prisma) => ({
  name: 'get_pending_tasks',
  displayName: 'Tareas Pendientes',
  description: 'Obtener tareas pendientes del usuario o del equipo',
  category: 'CRUD',
  keywords: ['tareas', 'pendientes', 'asignadas', 'mis tareas', 'tasks', 'pending'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: context.organizationId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: { assignee: true, client: true },
      orderBy: { priority: 'desc' },
    });
    return {
      success: true,
      data: { tasks, count: tasks.length },
      naturalLanguage: `Tienes ${tasks.length} tareas pendientes.`,
    };
  },
});

export const global_search: ToolFactory = (prisma) => ({
  name: 'global_search',
  displayName: 'Búsqueda Global',
  description: 'Buscar clientes, oportunidades, tareas y presupuestos en todo el sistema',
  category: 'CRUD',
  keywords: ['buscar', 'global', 'search', 'búsqueda', 'encontrar', 'todo'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const query = String(params.query ?? '').trim();
    if (!query) {
      return {
        success: false,
        error: 'Falta el parámetro "query"',
        naturalLanguage: '¿Qué quieres buscar?',
      };
    }
    const where = {
      organizationId: context.organizationId,
      OR: [
        { companyName: { contains: query, mode: 'insensitive' as const } },
        { contactName: { contains: query, mode: 'insensitive' as const } },
        { email: { contains: query, mode: 'insensitive' as const } },
      ],
    };
    const [clients, deals, tasks, quotes] = await Promise.all([
      prisma.client.findMany({ where, take: 5 }),
      prisma.deal.findMany({
        where: {
          organizationId: context.organizationId,
          title: { contains: query, mode: 'insensitive' as const },
        },
        take: 5,
      }),
      prisma.task.findMany({
        where: {
          organizationId: context.organizationId,
          title: { contains: query, mode: 'insensitive' as const },
        },
        take: 5,
      }),
      prisma.quote.findMany({
        where: {
          organizationId: context.organizationId,
          title: { contains: query, mode: 'insensitive' as const },
        },
        take: 5,
      }),
    ]);
    const total = clients.length + deals.length + tasks.length + quotes.length;
    return {
      success: true,
      data: { clients, deals, tasks, quotes, total },
      naturalLanguage: `Encontré ${total} resultados para "${query}" (${clients.length} clientes, ${deals.length} oportunidades, ${tasks.length} tareas, ${quotes.length} presupuestos).`,
    };
  },
});

export const create_client: ToolFactory = (prisma, _eventBus) => ({
  name: 'create_client',
  displayName: 'Crear Cliente',
  description: 'Crear un nuevo cliente en el CRM',
  category: 'CRUD',
  keywords: ['crear', 'cliente', 'nuevo', 'empresa', 'alta', 'agregar'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: {
      companyName: { type: 'string' },
      contactName: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      address: { type: 'string' },
    },
    required: ['companyName'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const companyName = String(params.companyName ?? params.contactName ?? '').trim();
    if (!companyName) {
      return {
        success: false,
        error: 'Falta el nombre de la empresa',
        naturalLanguage: 'Necesito el nombre de la empresa.',
      };
    }
    const client = await prisma.client.create({
      data: {
        companyName,
        contactName: String(params.contactName ?? companyName),
        email: params.email ? String(params.email) : null,
        phone: params.phone ? String(params.phone) : null,
        address: params.address ? String(params.address) : null,
        organizationId: context.organizationId,
      },
    });
    return {
      success: true,
      data: client,
      naturalLanguage: `Cliente "${companyName}" creado correctamente.`,
    };
  },
});

export const create_task: ToolFactory = (prisma, _eventBus) => ({
  name: 'create_task',
  displayName: 'Crear Tarea',
  description: 'Crear una nueva tarea',
  category: 'CRUD',
  keywords: ['crear', 'tarea', 'nueva', 'recordatorio', 'to-do', 'pendiente'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      dueDate: { type: 'string', format: 'date-time' },
      clientId: { type: 'string' },
    },
    required: ['title'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const title = String(params.title ?? '').trim();
    if (!title) {
      return {
        success: false,
        error: 'Falta el título de la tarea',
        naturalLanguage: 'Necesito el título de la tarea.',
      };
    }
    const task = await prisma.task.create({
      data: {
        title,
        description: params.description ? String(params.description) : null,
        priority: (params.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') ?? 'MEDIUM',
        dueDate: params.dueDate ? new Date(String(params.dueDate)) : null,
        clientId: params.clientId ? String(params.clientId) : null,
        createdById: context.userId,
        organizationId: context.organizationId,
      },
    });
    return {
      success: true,
      data: task,
      naturalLanguage: `Tarea "${title}" creada correctamente.`,
    };
  },
});

export const search_clients: ToolFactory = (prisma) => ({
  name: 'search_clients',
  displayName: 'Buscar Clientes',
  description: 'Buscar clientes por nombre, empresa o email',
  category: 'CRUD',
  keywords: ['buscar', 'clientes', 'encontrar', 'search', 'búsqueda'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const query = String(params.query ?? '').trim();
    if (!query) {
      return {
        success: false,
        error: 'Falta el parámetro "query"',
        naturalLanguage: '¿Qué cliente buscas?',
      };
    }
    const clients = await prisma.client.findMany({
      where: {
        organizationId: context.organizationId,
        OR: [
          { companyName: { contains: query, mode: 'insensitive' as const } },
          { contactName: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
        ],
      },
      take: 10,
    });
    return {
      success: true,
      data: { clients, count: clients.length },
      naturalLanguage: `Encontré ${clients.length} clientes para "${query}".`,
    };
  },
});

export const crudTools: ToolFactory[] = [
  get_monthly_sales,
  get_open_opportunities,
  get_stale_opportunities,
  get_inactive_clients,
  get_pending_tasks,
  global_search,
  create_client,
  create_task,
  search_clients,
];
