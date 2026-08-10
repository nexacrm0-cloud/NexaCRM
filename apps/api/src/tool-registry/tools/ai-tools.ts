import { ToolDefinition, ToolContext, ToolResult } from '../tool.interface';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

type ToolFactory = (prisma: PrismaService, eventBus: EventBusService) => ToolDefinition;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es')}`;
}

export const get_business_insights: ToolFactory = (prisma) => ({
  name: 'get_business_insights',
  displayName: 'Insights del Negocio',
  description: 'Generar insights sobre el estado del negocio (ventas, tareas, presupuestos)',
  category: 'AI',
  keywords: ['análisis', 'insights', 'negocio', 'business', 'tendencias', 'trends', 'inteligencia'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const [projection, overdueTasks, unansweredQuotes, openDeals] = await Promise.all([
      prisma.dashboardProjection.findUnique({ where: { organizationId: context.organizationId } }),
      prisma.task.count({
        where: {
          organizationId: context.organizationId,
          dueDate: { lt: new Date() },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
      prisma.quote.count({
        where: {
          organizationId: context.organizationId,
          status: 'SENT',
          acceptedAt: null,
          rejectedAt: null,
        },
      }),
      prisma.deal.aggregate({
        where: {
          organizationId: context.organizationId,
          stage: { isWinStage: false, isLoseStage: false },
        },
        _sum: { value: true },
      }),
    ]);
    return {
      success: true,
      data: {
        sales: { amount: Number(projection?.monthlySales ?? 0), change: 0 },
        tasks: { overdue: overdueTasks },
        quotes: { unanswered: unansweredQuotes },
        pipeline: { openCount: 0, totalValue: Number(openDeals._sum.value ?? 0) },
      },
      naturalLanguage: `Insights: ventas del mes ${formatCurrency(Number(projection?.monthlySales ?? 0))}, ${overdueTasks} tareas vencidas, ${unansweredQuotes} presupuestos sin respuesta, pipeline abierto ${formatCurrency(Number(openDeals._sum.value ?? 0))}.`,
    };
  },
});

export const get_recommended_actions: ToolFactory = (prisma) => ({
  name: 'get_recommended_actions',
  displayName: 'Acciones Recomendadas',
  description: 'Sugerir acciones prioritarias basadas en el estado del CRM',
  category: 'AI',
  keywords: [
    'acciones',
    'recomendadas',
    'sugeridas',
    'debería',
    'podría',
    'hacer',
    'prioridades',
    'recomiendas',
  ],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const [overdueTasks, unansweredQuotes, staleDeals] = await Promise.all([
      prisma.task.findMany({
        where: {
          organizationId: context.organizationId,
          dueDate: { lt: new Date() },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        take: 5,
      }),
      prisma.quote.findMany({
        where: {
          organizationId: context.organizationId,
          status: 'SENT',
          acceptedAt: null,
          rejectedAt: null,
        },
        include: { client: true },
        take: 5,
      }),
      prisma.deal.findMany({
        where: {
          organizationId: context.organizationId,
          updatedAt: { lt: new Date(Date.now() - 20 * 86400000) },
          stage: { isWinStage: false, isLoseStage: false },
        },
        include: { client: true },
        take: 5,
      }),
    ]);
    const actions: Array<{ priority: 'high' | 'medium' | 'low'; description: string }> = [];
    for (const t of overdueTasks)
      actions.push({ priority: 'high', description: `Completar tarea vencida: ${t.title}` });
    for (const q of unansweredQuotes)
      actions.push({
        priority: 'high',
        description: `Seguir presupuesto ${q.number} de ${q.client?.companyName ?? 'cliente'}`,
      });
    for (const d of staleDeals)
      actions.push({ priority: 'medium', description: `Reactivar oportunidad "${d.title}"` });
    if (actions.length === 0)
      actions.push({
        priority: 'low',
        description: 'Todo al día. Considera prospectar nuevos clientes.',
      });
    return {
      success: true,
      data: { actions, count: actions.length },
      naturalLanguage: `Te recomiendo ${actions.length} acción(es) prioritarias.`,
    };
  },
});

export const get_proactive_alerts: ToolFactory = (prisma) => ({
  name: 'get_proactive_alerts',
  displayName: 'Alertas Proactivas',
  description: 'Detectar riesgos y oportunidades en el CRM (churn, oportunidades estancadas, etc.)',
  category: 'AI',
  keywords: [
    'alertas',
    'proactivas',
    'riesgos',
    'problemas',
    'pipeline',
    'clientes',
    'tengo',
    'hay',
  ],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const [overdueTasks, staleDeals, unhealthyClients] = await Promise.all([
      prisma.task.count({
        where: {
          organizationId: context.organizationId,
          dueDate: { lt: new Date() },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
      prisma.deal.count({
        where: {
          organizationId: context.organizationId,
          updatedAt: { lt: new Date(Date.now() - 20 * 86400000) },
          stage: { isWinStage: false, isLoseStage: false },
        },
      }),
      prisma.client.count({
        where: {
          organizationId: context.organizationId,
          deals: { none: { updatedAt: { gte: new Date(Date.now() - 90 * 86400000) } } },
        },
      }),
    ]);
    const alerts: Array<{ type: string; severity: 'high' | 'medium' | 'low'; message: string }> =
      [];
    if (overdueTasks > 0)
      alerts.push({
        type: 'overdue_tasks',
        severity: 'high',
        message: `${overdueTasks} tareas vencidas`,
      });
    if (staleDeals > 0)
      alerts.push({
        type: 'stale_deals',
        severity: 'medium',
        message: `${staleDeals} oportunidades estancadas`,
      });
    if (unhealthyClients > 0)
      alerts.push({
        type: 'client_churn',
        severity: 'high',
        message: `${unhealthyClients} clientes en riesgo de churn`,
      });
    return {
      success: true,
      data: { alerts, totalCount: alerts.length },
      naturalLanguage:
        alerts.length === 0
          ? 'Todo en orden, sin alertas.'
          : `${alerts.length} alertas: ${alerts.map((a) => a.message).join(', ')}.`,
    };
  },
});

export const get_financial_forecast: ToolFactory = (prisma) => ({
  name: 'get_financial_forecast',
  displayName: 'Pronóstico Financiero',
  description: 'Proyectar ingresos futuros basados en pipeline abierto y tasa de conversión',
  category: 'AI',
  keywords: [
    'pronóstico',
    'financiero',
    'proyección',
    'forecast',
    'ventas',
    'ingresos',
    'venderemos',
    'facturaremos',
  ],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const [openDeals, wonProjection] = await Promise.all([
      prisma.deal.aggregate({
        where: {
          organizationId: context.organizationId,
          stage: { isWinStage: false, isLoseStage: false },
        },
        _sum: { value: true },
        _avg: { probability: true },
      }),
      prisma.dashboardProjection.findUnique({ where: { organizationId: context.organizationId } }),
    ]);
    const pipelineValue = Number(openDeals._sum.value ?? 0);
    const avgProbability = Number(openDeals._avg.probability ?? 0);
    const forecast = Math.round((pipelineValue * avgProbability) / 100);
    return {
      success: true,
      data: {
        pipelineValue,
        avgProbability,
        forecast,
        currentMonthlySales: Number(wonProjection?.monthlySales ?? 0),
      },
      naturalLanguage: `Pronóstico: pipeline abierto ${formatCurrency(pipelineValue)}, probabilidad media ${avgProbability}%, ingreso esperado ${formatCurrency(forecast)}.`,
    };
  },
});

export const get_pipeline_health: ToolFactory = (prisma) => ({
  name: 'get_pipeline_health',
  displayName: 'Salud del Pipeline',
  description: 'Evaluar conversión, velocidad y estancamiento del pipeline',
  category: 'AI',
  keywords: ['salud', 'pipeline', 'conversión', 'velocidad', 'estancamiento', 'cómo', 'está'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const [openCount, wonCount, lostCount] = await Promise.all([
      prisma.deal.count({
        where: {
          organizationId: context.organizationId,
          stage: { isWinStage: false, isLoseStage: false },
        },
      }),
      prisma.deal.count({
        where: { organizationId: context.organizationId, stage: { isWinStage: true } },
      }),
      prisma.deal.count({
        where: { organizationId: context.organizationId, stage: { isLoseStage: true } },
      }),
    ]);
    const closedTotal = wonCount + lostCount;
    const conversionRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;
    return {
      success: true,
      data: { openCount, wonCount, lostCount, conversionRate },
      naturalLanguage: `Pipeline: ${openCount} abiertos, ${wonCount} ganados, ${lostCount} perdidos, conversión ${conversionRate}%.`,
    };
  },
});

export const aiTools: ToolFactory[] = [
  get_business_insights,
  get_recommended_actions,
  get_proactive_alerts,
  get_financial_forecast,
  get_pipeline_health,
];
