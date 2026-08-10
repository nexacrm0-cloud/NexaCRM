import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';

export interface IntentResult {
  intent: string;
  confidence: number;
  toolName: string | null;
  params: Record<string, unknown>;
  detectionMethod: 'fast' | 'slow';
  originalInput: string;
}

interface FastPattern {
  regex: RegExp;
  intent: string;
  toolName: string | null;
  paramExtractor?: (match: RegExpMatchArray) => Record<string, unknown>;
}

@Injectable()
export class IntentDetectionService {
  private readonly logger = new Logger(IntentDetectionService.name);

  private readonly fastPatterns: FastPattern[] = [
    // Sales
    { regex: /ventas?\s*(del\s+)?mes/i, intent: 'monthly_sales', toolName: 'get_monthly_sales' },
    {
      regex: /cu[áa]nto\s+(vendimos|facturamos)/i,
      intent: 'monthly_sales',
      toolName: 'get_monthly_sales',
    },
    {
      regex: /facturaci[óo]n\s*(del\s+)?mes/i,
      intent: 'monthly_sales',
      toolName: 'get_monthly_sales',
    },

    // Open opportunities
    {
      regex: /oportunidade?s?\s*abiertas?/i,
      intent: 'open_opportunities',
      toolName: 'get_open_opportunities',
    },
    {
      regex: /negocios?\s*abiertos?/i,
      intent: 'open_opportunities',
      toolName: 'get_open_opportunities',
    },
    {
      regex: /pipeline\s*(activo|actual)/i,
      intent: 'open_opportunities',
      toolName: 'get_open_opportunities',
    },
    {
      regex: /deals?\s*(abiertos?|activos?)/i,
      intent: 'open_opportunities',
      toolName: 'get_open_opportunities',
    },

    // Stale opportunities
    {
      regex: /oportunidade?s?\s*(inactivas?|estancadas?)/i,
      intent: 'stale_opportunities',
      toolName: 'get_stale_opportunities',
    },
    {
      regex: /(m[áa]s\s+de\s+\d+\s+d[ií]as\s+sin\s+actividad)/i,
      intent: 'stale_opportunities',
      toolName: 'get_stale_opportunities',
    },
    {
      regex: /sin\s+actividad/i,
      intent: 'stale_opportunities',
      toolName: 'get_stale_opportunities',
    },

    // Inactive clients
    {
      regex: /clientes?\s*(inactivos?|sin\s+compra)/i,
      intent: 'inactive_clients',
      toolName: 'get_inactive_clients',
    },
    {
      regex: /clientes?\s+que\s+no\s+(compran|han\s+comprado)/i,
      intent: 'inactive_clients',
      toolName: 'get_inactive_clients',
    },

    // Pending tasks
    {
      regex: /(mis\s+)?tareas?\s*(pendientes?|asignadas?)/i,
      intent: 'pending_tasks',
      toolName: 'get_pending_tasks',
    },
    {
      regex: /qu[eé]\s+(tengo|hay)\s+(pendiente|por\s+hacer)/i,
      intent: 'pending_tasks',
      toolName: 'get_pending_tasks',
    },

    // Search clients (specific)
    {
      regex: /buscar\s+(cliente|empresa|contacto)/i,
      intent: 'search_clients',
      toolName: 'search_clients',
      paramExtractor: (match) => ({ query: match[1] || '' }),
    },
    {
      regex: /encontrar\s+(cliente|empresa|contacto)/i,
      intent: 'search_clients',
      toolName: 'search_clients',
      paramExtractor: (match) => ({ query: match[1] || '' }),
    },

    // Global search (catch-all for "buscar X")
    {
      regex: /buscar\s+(.+)$/i,
      intent: 'global_search',
      toolName: 'global_search',
      paramExtractor: (match) => ({ query: match[1]?.trim() || '' }),
    },
    {
      regex: /search\s+(.+)$/i,
      intent: 'global_search',
      toolName: 'global_search',
      paramExtractor: (match) => ({ query: match[1]?.trim() || '' }),
    },

    // Dashboard summary
    {
      regex: /^(dashboard|resumen|panel|panorama|general)\s*(del\s+)?(d[ií]a|mes)?$/i,
      intent: 'dashboard_summary',
      toolName: 'get_dashboard_summary',
    },
    { regex: /c[oó]mo\s+vamos/i, intent: 'dashboard_summary', toolName: 'get_dashboard_summary' },
    {
      regex: /dame\s+un\s+resumen/i,
      intent: 'dashboard_summary',
      toolName: 'get_dashboard_summary',
    },

    // Navigation
    {
      regex: /^(ir\s+a|abrir|navegar\s+a?|vamos\s+a)\s+(.+)$/i,
      intent: 'navigate',
      toolName: null,
      paramExtractor: (match) => ({ destination: match[2]?.trim() || match[1]?.trim() || '' }),
    },

    // Create client
    {
      regex: /(crear|nuev[oa]|dar\s+de\s+alta|agregar)\s+(cliente|empresa|contacto)/i,
      intent: 'create_client',
      toolName: 'create_client',
    },

    // Create task
    {
      regex: /(crear|nueva|agendar)\s+(tarea|recordatorio)/i,
      intent: 'create_task',
      toolName: 'create_task',
    },

    // Client count
    {
      regex: /cu[aá]ntos\s+clientes\s+(tengo|hay|tenemos)/i,
      intent: 'client_count',
      toolName: 'get_client_count',
    },
    {
      regex: /(cantidad|n[uú]mero)\s+(total\s+)?de\s+clientes/i,
      intent: 'client_count',
      toolName: 'get_client_count',
    },
    {
      regex: /(cu[aá]ntos|qu[eé])\s+clientes\s+(registrados|creados|activos)/i,
      intent: 'client_count',
      toolName: 'get_client_count',
    },

    // Due tasks
    {
      regex: /(tareas|qu[eé]\s+tareas)\s+(que\s+)?vencen\s+(hoy|hoy)/i,
      intent: 'due_tasks',
      toolName: 'get_due_tasks',
    },
    {
      regex: /(qu[eé]|cu[aá]les)\s+tareas\s+vienen/i,
      intent: 'due_tasks',
      toolName: 'get_due_tasks',
    },
    {
      regex: /tareas?\s+(para|de|del)\s+d[ií]a\s+de\s+hoy/i,
      intent: 'due_tasks',
      toolName: 'get_due_tasks',
    },

    // Activity this week
    {
      regex: /(actividad|movimiento|actividades)\s+(de\s+)?esta\s+semana/i,
      intent: 'activity_week',
      toolName: 'get_activity_week',
    },
    {
      regex: /res[uú]mime\s+(la\s+)?actividad/i,
      intent: 'activity_week',
      toolName: 'get_activity_week',
    },
    {
      regex: /qu[eé]\s+(pas[oó]|ocurri[oó]|hicimos)\s+esta\s+semana/i,
      intent: 'activity_week',
      toolName: 'get_activity_week',
    },
    { regex: /actividad\s+semanal/i, intent: 'activity_week', toolName: 'get_activity_week' },

    // Open opportunities (more specific pattern for "siguen abiertas")
    {
      regex: /(oportunidades|negocios)\s+(siguen\s+)?abiertas?/i,
      intent: 'open_opportunities',
      toolName: 'get_open_opportunities',
    },

    // Dashboard metrics (from projections)
    {
      regex: /m[eé]tricas?\s+(del\s+)?dashboard/i,
      intent: 'dashboard_metrics',
      toolName: 'get_dashboard_metrics',
    },
    {
      regex: /(indicadores|kpi|kpis)\s+(del\s+)?(panel|dashboard)/i,
      intent: 'dashboard_metrics',
      toolName: 'get_dashboard_metrics',
    },
    {
      regex: /proyecciones?\s+(del\s+)?dashboard/i,
      intent: 'dashboard_metrics',
      toolName: 'get_dashboard_metrics',
    },

    // Client full profile
    {
      regex: /qu[eé]\s+sabes?\s+(del|de\s+la|del)\s+cliente\s+(.+)$/i,
      intent: 'client_full_profile',
      toolName: 'get_client_full_profile',
      paramExtractor: (m) => ({ clientName: m[2]?.trim() }),
    },
    {
      regex: /d[ií]me\s+todo\s+(sobre|de|del)\s+cliente\s+(.+)$/i,
      intent: 'client_full_profile',
      toolName: 'get_client_full_profile',
      paramExtractor: (m) => ({ clientName: m[2]?.trim() }),
    },
    {
      regex: /informaci[óo]n\s+(completa\s+)?(del|del)\s+cliente\s+(.+)$/i,
      intent: 'client_full_profile',
      toolName: 'get_client_full_profile',
      paramExtractor: (m) => ({ clientName: m[3]?.trim() }),
    },
    {
      regex: /qui[eé]n\s+es\s+(.+)$/i,
      intent: 'client_full_profile',
      toolName: 'get_client_full_profile',
      paramExtractor: (m) => ({ clientName: m[1]?.trim() }),
    },
    {
      regex: /res[uú]meme\s+(el\s+)?cliente\s+(.+)$/i,
      intent: 'client_full_profile',
      toolName: 'get_client_full_profile',
      paramExtractor: (m) => ({ clientName: m[2]?.trim() }),
    },

    // Client deals
    {
      regex: /c[oó]mo\s+va(n)?\s+(la\s+)?oportunidad(\s+de)?\s+(.+)$/i,
      intent: 'client_deals',
      toolName: 'get_client_deals',
      paramExtractor: (m) => ({ clientName: m[4]?.trim() }),
    },
    {
      regex: /(muestra|dime|cu[áa]les\s+son)\s+(las\s+)?oportunidades?\s+(de|del|para)\s+(.+)$/i,
      intent: 'client_deals',
      toolName: 'get_client_deals',
      paramExtractor: (m) => ({ clientName: m[4]?.trim() }),
    },
    {
      regex: /(negocios?|deals?)\s+(de|del|para)\s+(.+)$/i,
      intent: 'client_deals',
      toolName: 'get_client_deals',
      paramExtractor: (m) => ({ clientName: m[3]?.trim() }),
    },
    {
      regex: /c[oó]mo\s+va(\s+el)?\s+(deal|negocio|oportunidad)\s+(de|del|con)\s+(.+)$/i,
      intent: 'client_deals',
      toolName: 'get_client_deals',
      paramExtractor: (m) => ({ clientName: m[4]?.trim() }),
    },

    // Client quotes
    {
      regex: /(muestra|dame|listame|ver)\s+(los\s+)?presupuestos?\s+(de|del|para)\s+(.+)$/i,
      intent: 'client_quotes',
      toolName: 'get_client_quotes',
      paramExtractor: (m) => ({ clientName: m[4]?.trim() }),
    },
    {
      regex: /(presupuestos?|cotizaciones?)\s+(de|del|para)\s+(.+)$/i,
      intent: 'client_quotes',
      toolName: 'get_client_quotes',
      paramExtractor: (m) => ({ clientName: m[3]?.trim() }),
    },
    {
      regex: /qu[eé]\s+presupuestos?\s+tiene\s+(.+)$/i,
      intent: 'client_quotes',
      toolName: 'get_client_quotes',
      paramExtractor: (m) => ({ clientName: m[1]?.trim() }),
    },

    // Client tasks
    {
      regex: /(muestra|dame|cu[áa]les\s+son)\s+(las\s+)?tareas?\s+(de|del|para)\s+(.+)$/i,
      intent: 'client_tasks',
      toolName: 'get_client_tasks',
      paramExtractor: (m) => ({ clientName: m[4]?.trim() }),
    },
    {
      regex: /qu[eé]\s+tareas?\s+tiene\s+(.+)$/i,
      intent: 'client_tasks',
      toolName: 'get_client_tasks',
      paramExtractor: (m) => ({ clientName: m[1]?.trim() }),
    },
    {
      regex: /tareas?\s+pendientes?\s+(de|del|para)\s+(.+)$/i,
      intent: 'client_tasks',
      toolName: 'get_client_tasks',
      paramExtractor: (m) => ({ clientName: m[2]?.trim() }),
    },

    // Unanswered quotes
    {
      regex: /(presupuestos?|cotizaciones?)\s+(sin\s+)?(respuesta|responder|contestar)/i,
      intent: 'unanswered_quotes',
      toolName: 'get_unanswered_quotes',
    },
    {
      regex: /quotes?\s+unanswered/i,
      intent: 'unanswered_quotes',
      toolName: 'get_unanswered_quotes',
    },
    {
      regex: /(presupuestos?|cotizaciones?)\s+pendientes?\s+de\s+respuesta/i,
      intent: 'unanswered_quotes',
      toolName: 'get_unanswered_quotes',
    },

    // Overdue tasks
    {
      regex: /tareas?\s+(vencidas?|atrasadas?|overdue)/i,
      intent: 'overdue_tasks',
      toolName: 'get_overdue_tasks',
    },
    {
      regex: /(qu[eé]|cu[áa]les)\s+tareas?\s+(est[áa]n|se)\s+(vencidas?|atrasadas?)/i,
      intent: 'overdue_tasks',
      toolName: 'get_overdue_tasks',
    },
    {
      regex: /tareas?\s+(que\s+)?vencieron/i,
      intent: 'overdue_tasks',
      toolName: 'get_overdue_tasks',
    },

    // Business insights
    {
      regex: /(an[aá]lisis|insights)\s+(del\s+)?(negocio|business)/i,
      intent: 'business_insights',
      toolName: 'get_business_insights',
    },
    {
      regex: /(c[oó]mo\s+)?(va\s+el\s+)?(negocio|business)\s*(en\s+general)?/i,
      intent: 'business_insights',
      toolName: 'get_business_insights',
    },
    {
      regex: /salud\s+(del\s+)?(negocio|business|pipeline)/i,
      intent: 'business_insights',
      toolName: 'get_business_insights',
    },
    {
      regex: /(tendencias|trends)\s+(del\s+)?negocio/i,
      intent: 'business_insights',
      toolName: 'get_business_insights',
    },
    {
      regex: /inteligencia\s+(del\s+)?negocio/i,
      intent: 'business_insights',
      toolName: 'get_business_insights',
    },

    // Recommended actions
    {
      regex:
        /(acciones?|qu[eé])\s+(recomendadas?|sugeridas?|deber[ií]a|podr[ií]a)\s+(hacer|tomar)/i,
      intent: 'recommended_actions',
      toolName: 'get_recommended_actions',
    },
    {
      regex: /recommended\s+actions/i,
      intent: 'recommended_actions',
      toolName: 'get_recommended_actions',
    },
    {
      regex: /qu[eé]\s+(me\s+)?recomiendas/i,
      intent: 'recommended_actions',
      toolName: 'get_recommended_actions',
    },
    {
      regex: /prioridades?\s+(del\s+)?(d[ií]a|d[ií]a|semana)/i,
      intent: 'recommended_actions',
      toolName: 'get_recommended_actions',
    },
    {
      regex: /(dame|quiero)\s+(mis\s+)?prioridades/i,
      intent: 'recommended_actions',
      toolName: 'get_recommended_actions',
    },

    // Proactive alerts
    {
      regex: /alertas?\s+proactivas?/i,
      intent: 'proactive_alerts',
      toolName: 'get_proactive_alerts',
    },
    {
      regex: /(qu[eé]\s+)?alertas?\s+(tengo|hay)/i,
      intent: 'proactive_alerts',
      toolName: 'get_proactive_alerts',
    },
    { regex: /proactive\s+alerts?/i, intent: 'proactive_alerts', toolName: 'get_proactive_alerts' },
    {
      regex: /(riesgos?|problemas?)\s+(del\s+)?(negocio|pipeline|clientes?)/i,
      intent: 'proactive_alerts',
      toolName: 'get_proactive_alerts',
    },

    // Financial forecast
    {
      regex: /pron[oó]stico\s+financiero/i,
      intent: 'financial_forecast',
      toolName: 'get_financial_forecast',
    },
    {
      regex: /(proyecci[oó]n|forecast)\s+(financiera|ventas|ingresos?)/i,
      intent: 'financial_forecast',
      toolName: 'get_financial_forecast',
    },
    {
      regex: /financial\s+forecast/i,
      intent: 'financial_forecast',
      toolName: 'get_financial_forecast',
    },
    {
      regex: /cu[aá]nto\s+(venderemos?|facturaremos?)\s+(en|pr[oó]ximos?)/i,
      intent: 'financial_forecast',
      toolName: 'get_financial_forecast',
    },

    // Pipeline health
    {
      regex: /salud\s+(del\s+)?pipeline/i,
      intent: 'pipeline_health',
      toolName: 'get_pipeline_health',
    },
    { regex: /pipeline\s+health/i, intent: 'pipeline_health', toolName: 'get_pipeline_health' },
    {
      regex: /c[oó]mo\s+est[aá]\s+el\s+pipeline/i,
      intent: 'pipeline_health',
      toolName: 'get_pipeline_health',
    },
    {
      regex: /(conversi[oó]n|velocidad|estancamiento)\s+(del\s+)?pipeline/i,
      intent: 'pipeline_health',
      toolName: 'get_pipeline_health',
    },

    // Client health
    {
      regex: /salud\s+(del\s+)?(cliente|clientes)/i,
      intent: 'client_health',
      toolName: 'get_client_health',
    },
    { regex: /client\s+health/i, intent: 'client_health', toolName: 'get_client_health' },
    {
      regex: /(riesgo|churn)\s+(de\s+)?(abandono|churn)/i,
      intent: 'client_health',
      toolName: 'get_client_health',
    },
    {
      regex: /clientes?\s+(en\s+riesgo|riesgo)/i,
      intent: 'client_health',
      toolName: 'get_client_health',
    },

    // Executive summary
    {
      regex: /resumen\s+ejecutivo/i,
      intent: 'executive_summary',
      toolName: 'get_executive_summary',
    },
    {
      regex: /executive\s+summary/i,
      intent: 'executive_summary',
      toolName: 'get_executive_summary',
    },
    {
      regex: /c[oó]mo\s+va\s+(el\s+)?(negocio|todo)/i,
      intent: 'executive_summary',
      toolName: 'get_executive_summary',
    },
    {
      regex: /dame\s+(un\s+)?resumen\s+(del\s+)?(negocio|general|mes)/i,
      intent: 'executive_summary',
      toolName: 'get_executive_summary',
    },
    {
      regex: /panorama\s+(general|del\s+negocio)/i,
      intent: 'executive_summary',
      toolName: 'get_executive_summary',
    },

    // Inventory / Stock
    {
      regex: /(cu[aá]nto\s+)?(stock|inventario|existencias)\s+(tengo|hay|tienes)/i,
      intent: 'inventory_summary',
      toolName: 'get_inventory_summary',
    },
    {
      regex: /c[oó]mo\s+(va|est[aá])\s+(el\s+)?(inventario|stock)/i,
      intent: 'inventory_summary',
      toolName: 'get_inventory_summary',
    },
    {
      regex: /resumen\s+(de\s+)?inventario/i,
      intent: 'inventory_summary',
      toolName: 'get_inventory_summary',
    },
    {
      regex: /valor\s+(del\s+)?inventario/i,
      intent: 'inventory_summary',
      toolName: 'get_inventory_summary',
    },

    {
      regex: /(productos?|items?)\s+(con\s+)?(stock\s+)?bajo/i,
      intent: 'low_stock_products',
      toolName: 'get_low_stock_products',
    },
    { regex: /low\s+stock/i, intent: 'low_stock_products', toolName: 'get_low_stock_products' },
    {
      regex: /qu[eé]\s+(productos?|items?)\s+(hay\s+que\s+)?(reponer|reordenar|pedir)/i,
      intent: 'low_stock_products',
      toolName: 'get_low_stock_products',
    },
    {
      regex: /faltantes?\s+(de\s+)?(stock|inventario)/i,
      intent: 'low_stock_products',
      toolName: 'get_low_stock_products',
    },

    {
      regex: /stock\s+(de|del)\s+(.+)$/i,
      intent: 'product_stock',
      toolName: 'get_product_stock',
      paramExtractor: (m) => ({ query: m[2]?.trim() }),
    },
    {
      regex: /cu[aá]nto\s+(stock|hay)\s+(de|del)\s+(.+)$/i,
      intent: 'product_stock',
      toolName: 'get_product_stock',
      paramExtractor: (m) => ({ query: m[3]?.trim() }),
    },
    {
      regex: /existencias?\s+(de|del)\s+(.+)$/i,
      intent: 'product_stock',
      toolName: 'get_product_stock',
      paramExtractor: (m) => ({ query: m[2]?.trim() }),
    },
  ];

  constructor(private readonly toolRegistry: ToolRegistryService) {}

  detect(input: string): IntentResult {
    const trimmed = input.trim();

    const fastResult = this.tryFastPath(trimmed);
    if (fastResult) {
      this.logger.debug(
        `Fast path matched: "${trimmed}" -> ${fastResult.intent} (confidence: ${fastResult.confidence})`,
      );
      return fastResult;
    }

    const slowResult = this.trySlowPath(trimmed);
    this.logger.debug(
      `Slow path result: "${trimmed}" -> ${slowResult.intent} (confidence: ${slowResult.confidence})`,
    );
    return slowResult;
  }

  private tryFastPath(input: string): IntentResult | null {
    for (const pattern of this.fastPatterns) {
      const match = input.match(pattern.regex);
      if (match) {
        const params = pattern.paramExtractor ? pattern.paramExtractor(match) : {};
        return {
          intent: pattern.intent,
          confidence: 1.0,
          toolName: pattern.toolName,
          params,
          detectionMethod: 'fast',
          originalInput: input,
        };
      }
    }
    return null;
  }

  private trySlowPath(input: string): IntentResult {
    const tokens = this.tokenize(input);
    if (tokens.length === 0) {
      return {
        intent: 'unknown',
        confidence: 0,
        toolName: null,
        params: { original: input },
        detectionMethod: 'slow',
        originalInput: input,
      };
    }

    const tools = this.toolRegistry.getAll();
    let bestScore = 0;
    let bestTool: { name: string; intent: string } | null = null;
    let bestParams: Record<string, unknown> = { original: input };

    for (const tool of tools) {
      const signature = this.buildSignature(
        tool.name,
        tool.description,
        tool.keywords,
        tool.inputSchema,
      );
      const score = this.calculateSimilarity(tokens, signature);

      if (tool.name === 'search_clients') {
        const searchScore = this.calculateSearchScore(tokens);
        const combined = Math.max(score, searchScore);
        if (combined > bestScore) {
          bestScore = combined;
          bestTool = { name: tool.name, intent: 'search_clients' };
          bestParams = { query: input };
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTool = {
          name: tool.name,
          intent: tool.name.replace(/^(get_|create_)/, '').replace(/_/g, '_'),
        };
        bestParams = { original: input };
      }
    }

    if (bestScore >= 0.15) {
      return {
        intent: bestTool!.intent,
        confidence: bestScore,
        toolName: bestTool!.name,
        params: bestParams,
        detectionMethod: 'slow',
        originalInput: input,
      };
    }

    return {
      intent: 'unknown',
      confidence: bestScore,
      toolName: null,
      params: { original: input },
      detectionMethod: 'slow',
      originalInput: input,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  private buildSignature(
    name: string,
    description: string,
    keywords: string[],
    _inputSchema: Record<string, unknown>,
  ): Set<string> {
    const words = new Set<string>();
    for (const w of this.tokenize(name)) words.add(w);
    for (const w of this.tokenize(description)) words.add(w);
    for (const kw of keywords) {
      for (const w of this.tokenize(kw)) words.add(w);
    }
    return words;
  }

  private calculateSimilarity(inputTokens: string[], signature: Set<string>): number {
    if (inputTokens.length === 0 || signature.size === 0) return 0;

    let matchCount = 0;
    for (const token of inputTokens) {
      if (signature.has(token)) {
        matchCount++;
      } else {
        for (const sigWord of signature) {
          if (this.bigramSimilarity(token, sigWord) > 0.6) {
            matchCount += 0.5;
            break;
          }
        }
      }
    }

    return matchCount / Math.max(inputTokens.length, 1);
  }

  private calculateSearchScore(inputTokens: string[]): number {
    const searchKeywords = ['buscar', 'encuentra', 'dónde', 'buscando', 'search', 'find', 'look'];
    const match = inputTokens.filter((t) => searchKeywords.includes(t)).length;
    return match / Math.max(inputTokens.length, 1);
  }

  private bigramSimilarity(a: string, b: string): number {
    const bigramsA = this.getBigrams(a);
    const bigramsB = this.getBigrams(b);
    if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

    let intersection = 0;
    for (const bigram of bigramsA) {
      if (bigramsB.has(bigram)) intersection++;
    }

    return (2 * intersection) / (bigramsA.size + bigramsB.size);
  }

  private getBigrams(s: string): Set<string> {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  }
}
