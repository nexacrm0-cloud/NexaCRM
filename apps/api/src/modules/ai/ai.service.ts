import { Injectable, Logger } from '@nestjs/common';
import { IntentDetectionService } from '../../intent-detection/intent-detection.service';
import { ToolRegistryService } from '../../tool-registry/tool-registry.service';
import { ToolContext } from '../../tool-registry/tool.interface';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

export interface AiResponse {
  type: 'answer' | 'action' | 'error';
  message: string;
  data?: unknown;
  action?: {
    tool: string;
    parameters: Record<string, unknown>;
    result?: unknown;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly intentDetection: IntentDetectionService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async processQuery(query: string, user: AuthenticatedUser): Promise<{ data: AiResponse }> {
    try {
      const intent = this.intentDetection.detect(query);
      this.logger.log(
        `AI Query: "${query}" -> Intent: ${intent.intent} (${intent.detectionMethod}, ${intent.confidence})`,
      );

      if (intent.confidence < 0.15 || !intent.toolName) {
        return {
          data: {
            type: 'answer',
            message:
              'No pude determinar exactamente qué necesitas. Intenta preguntar sobre ventas, clientes, oportunidades o tareas.',
          },
        };
      }

      return this.executeTool(intent.toolName, intent.params, user, query);
    } catch (error: unknown) {
      this.logger.error(`AI Error: ${error instanceof Error ? error.message : error}`);
      return {
        data: {
          type: 'error',
          message: 'Ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.',
        },
      };
    }
  }

  async processCommand(query: string, user: AuthenticatedUser): Promise<{ data: AiResponse }> {
    try {
      const intent = this.intentDetection.detect(query);
      this.logger.log(
        `AI Command: "${query}" -> Intent: ${intent.intent} (${intent.detectionMethod}, ${intent.confidence})`,
      );

      if (intent.confidence < 0.15) {
        return {
          data: {
            type: 'answer',
            message:
              'No pude determinar el comando. Intenta con: "Crear cliente ...", "Agendar tarea ..." o "Buscar ..."',
          },
        };
      }

      if (intent.intent === 'create_client') {
        const params = { ...intent.params, ...this.extractClientParams(query) };
        return this.executeTool('create_client', params, user, query);
      }

      if (intent.intent === 'create_task') {
        const params = { ...intent.params, ...this.extractTaskParams(query) };
        return this.executeTool('create_task', params, user, query);
      }

      if (intent.toolName) {
        return this.executeTool(intent.toolName, intent.params, user, query);
      }

      return this.processQuery(query, user);
    } catch (error: unknown) {
      this.logger.error(`AI Command Error: ${error instanceof Error ? error.message : error}`);
      return {
        data: {
          type: 'error',
          message:
            'No pude ejecutar ese comando. Intenta con: "Crear cliente ...", "Agendar tarea ..." o "Buscar ..."',
        },
      };
    }
  }

  async generateSummary(
    user: AuthenticatedUser,
  ): Promise<{ data: { summary: string; insights?: Record<string, unknown> } }> {
    const toolContext: ToolContext = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: [],
    };

    const [metricsResult, activityResult, insightsResult] = await Promise.all([
      this.toolRegistry.execute('get_dashboard_metrics', {}, toolContext),
      this.toolRegistry.execute('get_activity_week', {}, toolContext),
      this.toolRegistry
        .execute('get_business_insights', {}, toolContext)
        .catch(() => ({ success: false, data: null })),
    ]);

    const metrics = metricsResult.data as Record<string, unknown> | undefined;
    const activities = activityResult.data as Array<Record<string, unknown>> | undefined;
    const insights = insightsResult.data as Record<string, unknown> | null;

    const parts: string[] = [];

    if (metrics) {
      const monthlySales = Number(metrics.monthlySales || 0);
      const newClients = Number(metrics.newClients || 0);
      const openOpportunities = Number(metrics.openOpportunities || 0);
      const pendingTasks = Number(metrics.pendingTasks || 0);

      if (monthlySales > 0) {
        parts.push(`Este mes facturaste **$${monthlySales.toLocaleString()}**.`);
      } else {
        parts.push('Este mes aún no registras ventas.');
      }

      parts.push(
        `Tienes **${openOpportunities} oportunidades** abiertas y **${pendingTasks} tareas** pendientes.`,
      );
      parts.push(`Han ingresado **${newClients} nuevos clientes** en lo que va del mes.`);

      if (insights) {
        const s = insights as Record<string, any>;
        const sales = s.sales as Record<string, any> | undefined;
        const tasks = s.tasks as Record<string, any> | undefined;
        const quotes = s.quotes as Record<string, any> | undefined;

        if (sales?.change !== undefined && sales.change !== 0) {
          parts.push(
            `(ventas ${sales.change > 0 ? '+' : ''}${String(sales.change)}% vs mes anterior)`,
          );
        }
        if (tasks?.overdue && Number(tasks.overdue) > 0) {
          parts.push(`⚠️ ${String(tasks.overdue)} tareas vencidas.`);
        }
        if (quotes?.unanswered && Number(quotes.unanswered) > 0) {
          parts.push(`${String(quotes.unanswered)} presupuestos sin respuesta.`);
        }
      }
    } else {
      parts.push(metricsResult.naturalLanguage || 'No hay datos disponibles.');
    }

    if (activities && activities.length > 0) {
      const last = activities[0] as Record<string, unknown> | undefined;
      if (last) {
        const u = last.user as Record<string, string> | undefined;
        const userName = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Alguien';
        parts.push(`Última actividad: ${userName} — ${String(last.description ?? '')}`);
      }
      parts.push(`(${activities.length} actividades registradas esta semana)`);
    }

    return { data: { summary: parts.join(' '), insights: insights ?? undefined } };
  }

  async processAnalyze(
    user: AuthenticatedUser,
  ): Promise<{
    data: { insights: Record<string, unknown>; actions: Array<Record<string, unknown>> };
  }> {
    const toolContext: ToolContext = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: [],
    };

    const [insightsResult, actionsResult] = await Promise.all([
      this.toolRegistry.execute('get_business_insights', {}, toolContext),
      this.toolRegistry.execute('get_recommended_actions', {}, toolContext),
    ]);

    return {
      data: {
        insights: (insightsResult.data as Record<string, unknown>) ?? {},
        actions:
          ((actionsResult.data as Record<string, any>)?.actions as Array<
            Record<string, unknown>
          >) ?? [],
      },
    };
  }

  private extractClientParams(query: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    const nameMatch = query.match(
      /(?:llamad[oa]|empresa|para)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]*(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/,
    );
    const emailMatch = query.match(
      /email\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    );
    const phoneMatch = query.match(/teléfono\s+([+\d\s()-]{7,})|([+\d\s()-]{7,})/);

    if (nameMatch) {
      params.companyName = nameMatch[1] || nameMatch[0];
      params.contactName = params.companyName;
    }

    if (emailMatch) {
      params.email = emailMatch[1] || emailMatch[2];
    }

    if (phoneMatch) {
      params.phone = phoneMatch[1] || phoneMatch[2];
    }

    if (!params.companyName) {
      const words = query
        .replace(/^(crear|nuevo|nueva)\s+(cliente|empresa|contacto)\s+/i, '')
        .trim();
      if (words) {
        params.companyName = words;
        params.contactName = words;
      }
    }

    return params;
  }

  private extractTaskParams(query: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    const titleMatch = query.match(
      /(?:tarea|recordatorio)\s+(?:para\s+|de\s+)?(.+?)(?:,\s*(?:prioridad|para|con|mañana|hoy|el\s+\d+|$))/i,
    );
    if (titleMatch && titleMatch[1]) {
      params.title = titleMatch[1].trim();
    }

    if (query.includes('urgent') || query.includes('URGENT') || query.includes('urgente')) {
      params.priority = 'URGENT';
    } else if (query.includes('alta') || query.includes('HIGH')) {
      params.priority = 'HIGH';
    } else if (query.includes('baja') || query.includes('LOW')) {
      params.priority = 'LOW';
    }

    if (query.includes('mañana')) {
      params.dueDate = new Date(Date.now() + 86400000).toISOString();
    } else if (query.includes('hoy')) {
      params.dueDate = new Date().toISOString();
    }

    if (!params.title) {
      const words = query.replace(/^(crear|nueva|nuevo)\s+(tarea|recordatorio)\s+/i, '').trim();
      if (words) {
        params.title = words;
      }
    }

    return params;
  }

  private async executeTool(
    tool: string,
    params: Record<string, unknown>,
    user: AuthenticatedUser,
    _originalQuery: string,
  ): Promise<{ data: AiResponse }> {
    const context: ToolContext = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: [],
    };

    const result = await this.toolRegistry.execute(tool, params, context);

    return {
      data: {
        type: 'answer',
        message:
          result.naturalLanguage ||
          (result.success ? 'Ejecutado correctamente' : result.error || 'Error desconocido'),
        data: result.data,
        action: { tool, parameters: params, result: result.data },
      },
    };
  }

  async getProactiveAlerts(
    user: AuthenticatedUser,
  ): Promise<{ data: { alerts: unknown[]; total: number; naturalLanguage: string } }> {
    const context: ToolContext = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: [],
    };

    const result = await this.toolRegistry.execute('get_proactive_alerts', {}, context);

    return {
      data: {
        alerts: (result.data as any)?.alerts ?? [],
        total: (result.data as any)?.totalCount ?? 0,
        naturalLanguage: result.naturalLanguage || '',
      },
    };
  }
}
