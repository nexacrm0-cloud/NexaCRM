import { ToolDefinition, ToolContext, ToolResult } from '../tool.interface';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

type ToolFactory = (prisma: PrismaService, eventBus: EventBusService) => ToolDefinition;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es')}`;
}

export const get_dashboard_summary: ToolFactory = (prisma) => ({
  name: 'get_dashboard_summary',
  displayName: 'Resumen del Dashboard',
  description: 'Obtener un resumen general del dashboard del usuario',
  category: 'CRUD',
  keywords: ['dashboard', 'resumen', 'panel', 'panorama', 'general', 'cómo', 'vamos'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const projection = await prisma.dashboardProjection.findUnique({
      where: { organizationId: context.organizationId },
    });
    if (!projection) {
      return { success: true, data: null, naturalLanguage: 'No hay datos del dashboard aún.' };
    }
    return {
      success: true,
      data: projection,
      naturalLanguage: `Resumen: ${formatCurrency(Number(projection.monthlySales))} en ventas, ${projection.openOpportunities} oportunidades, ${projection.pendingTasks} tareas pendientes.`,
    };
  },
});

export const get_client_count: ToolFactory = (prisma) => ({
  name: 'get_client_count',
  displayName: 'Contar Clientes',
  description: 'Obtener el número total de clientes',
  category: 'CRUD',
  keywords: ['cuántos', 'clientes', 'tengo', 'hay', 'tenemos', 'cantidad'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const count = await prisma.client.count({ where: { organizationId: context.organizationId } });
    return {
      success: true,
      data: { count },
      naturalLanguage: `Tienes ${count} clientes registrados.`,
    };
  },
});

export const get_due_tasks: ToolFactory = (prisma) => ({
  name: 'get_due_tasks',
  displayName: 'Tareas para Hoy',
  description: 'Obtener tareas que vencen hoy',
  category: 'CRUD',
  keywords: ['tareas', 'vencen', 'hoy', 'vienen', 'día', 'due', 'today'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const tasks = await prisma.task.findMany({
      where: {
        organizationId: context.organizationId,
        dueDate: { gte: start, lte: end },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: { assignee: true, client: true },
    });
    return {
      success: true,
      data: { tasks, count: tasks.length },
      naturalLanguage: `Tienes ${tasks.length} tareas que vencen hoy.`,
    };
  },
});

export const get_activity_week: ToolFactory = (prisma) => ({
  name: 'get_activity_week',
  displayName: 'Actividad Semanal',
  description: 'Obtener la actividad registrada en la última semana',
  category: 'CRUD',
  keywords: ['actividad', 'movimiento', 'actividades', 'semana', 'semanal', 'pasó'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activities = await prisma.activityLog.findMany({
      where: { organizationId: context.organizationId, createdAt: { gte: since } },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      success: true,
      data: activities,
      naturalLanguage: `${activities.length} actividades registradas esta semana.`,
    };
  },
});

export const get_dashboard_metrics: ToolFactory = (prisma) => ({
  name: 'get_dashboard_metrics',
  displayName: 'Métricas del Dashboard',
  description:
    'Obtener las métricas proyectadas del dashboard (ventas, oportunidades, tareas, nuevos clientes)',
  category: 'CRUD',
  keywords: ['métricas', 'dashboard', 'indicadores', 'kpi', 'kpis', 'panel', 'proyecciones'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const projection = await prisma.dashboardProjection.findUnique({
      where: { organizationId: context.organizationId },
    });
    const data = {
      monthlySales: Number(projection?.monthlySales ?? 0),
      newClients: Number(projection?.newClients ?? 0),
      openOpportunities: Number(projection?.openOpportunities ?? 0),
      pendingTasks: Number(projection?.pendingTasks ?? 0),
      wonDeals: (projection?.wonDeals as unknown[]) ?? [],
    };
    return {
      success: true,
      data,
      naturalLanguage: `Métricas: ${formatCurrency(data.monthlySales)} en ventas, ${data.openOpportunities} oportunidades abiertas, ${data.pendingTasks} tareas pendientes, ${data.newClients} nuevos clientes.`,
    };
  },
});

export const get_executive_summary: ToolFactory = (prisma) => ({
  name: 'get_executive_summary',
  displayName: 'Resumen Ejecutivo',
  description: 'Obtener un resumen ejecutivo del estado del negocio',
  category: 'AI',
  keywords: ['resumen', 'ejecutivo', 'executive', 'summary', 'negocio', 'panorama'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const [projection, clientCount, openDeals] = await Promise.all([
      prisma.dashboardProjection.findUnique({ where: { organizationId: context.organizationId } }),
      prisma.client.count({ where: { organizationId: context.organizationId } }),
      prisma.deal.count({
        where: {
          organizationId: context.organizationId,
          stage: { isWinStage: false, isLoseStage: false },
        },
      }),
    ]);
    return {
      success: true,
      data: {
        monthlySales: Number(projection?.monthlySales ?? 0),
        newClients: Number(projection?.newClients ?? 0),
        pendingTasks: Number(projection?.pendingTasks ?? 0),
        totalClients: clientCount,
        openOpportunities: openDeals,
      },
      naturalLanguage: `Estado del negocio: ${formatCurrency(Number(projection?.monthlySales ?? 0))} en ventas del mes, ${clientCount} clientes totales, ${openDeals} oportunidades abiertas, ${Number(projection?.pendingTasks ?? 0)} tareas pendientes.`,
    };
  },
});

export const dashboardTools: ToolFactory[] = [
  get_dashboard_summary,
  get_client_count,
  get_due_tasks,
  get_activity_week,
  get_dashboard_metrics,
  get_executive_summary,
];
