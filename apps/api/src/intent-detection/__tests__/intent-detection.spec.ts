import { IntentDetectionService } from '../intent-detection.service';
import { ToolRegistryService } from '../../tool-registry/tool-registry.service';
import { ToolDefinition, ToolContext, ToolResult } from '../../tool-registry/tool.interface';

function mockTool(name: string, description: string, keywords: string[]): ToolDefinition {
  return {
    name,
    displayName: name,
    description,
    category: 'CRUD',
    keywords,
    permissions: [],
    inputSchema: { type: 'object', properties: {} },
    handler: jest
      .fn<Promise<ToolResult>, [Record<string, unknown>, ToolContext]>()
      .mockResolvedValue({ success: true }),
  };
}

describe('IntentDetectionService', () => {
  let toolRegistry: ToolRegistryService;
  let service: IntentDetectionService;

  beforeEach(() => {
    toolRegistry = new ToolRegistryService();
    toolRegistry.register(
      mockTool('get_monthly_sales', 'Obtener ventas del mes', ['ventas', 'mes', 'facturación']),
    );
    toolRegistry.register(
      mockTool('get_open_opportunities', 'Obtener oportunidades abiertas', [
        'oportunidades',
        'pipeline',
      ]),
    );
    toolRegistry.register(
      mockTool('get_pending_tasks', 'Obtener tareas pendientes', ['tareas', 'pendientes']),
    );
    toolRegistry.register(mockTool('search_clients', 'Buscar clientes', ['buscar', 'clientes']));
    toolRegistry.register(
      mockTool('get_dashboard_summary', 'Resumen del dashboard', ['dashboard', 'resumen']),
    );
    service = new IntentDetectionService(toolRegistry);
  });

  describe('fast path', () => {
    it('detects monthly sales intent', () => {
      const result = service.detect('¿Cuánto vendimos este mes?');
      expect(result.intent).toBe('monthly_sales');
      expect(result.toolName).toBe('get_monthly_sales');
      expect(result.confidence).toBe(1);
      expect(result.detectionMethod).toBe('fast');
    });

    it('detects open opportunities intent', () => {
      const result = service.detect('Muéstrame las oportunidades abiertas');
      expect(result.intent).toBe('open_opportunities');
      expect(result.toolName).toBe('get_open_opportunities');
    });

    it('detects pending tasks intent', () => {
      const result = service.detect('mis tareas pendientes');
      expect(result.intent).toBe('pending_tasks');
      expect(result.toolName).toBe('get_pending_tasks');
    });

    it('detects stale opportunities intent', () => {
      const result = service.detect('oportunidades inactivas');
      expect(result.intent).toBe('stale_opportunities');
      expect(result.toolName).toBe('get_stale_opportunities');
    });

    it('detects inactive clients intent', () => {
      const result = service.detect('clientes inactivos');
      expect(result.intent).toBe('inactive_clients');
      expect(result.toolName).toBe('get_inactive_clients');
    });

    it('detects dashboard summary intent', () => {
      const result = service.detect('dashboard');
      expect(result.intent).toBe('dashboard_summary');
      expect(result.toolName).toBe('get_dashboard_summary');
    });

    it('detects search clients intent', () => {
      const result = service.detect('buscar cliente Acme');
      expect(result.intent).toBe('search_clients');
      expect(result.toolName).toBe('search_clients');
    });

    it('detects navigation intent', () => {
      const result = service.detect('ir a clientes');
      expect(result.intent).toBe('navigate');
      expect(result.toolName).toBeNull();
      expect(result.params.destination).toBe('clientes');
    });

    it('detects create client intent', () => {
      const result = service.detect('crear nuevo cliente');
      expect(result.intent).toBe('create_client');
      expect(result.toolName).toBe('create_client');
    });

    it('detects create task intent', () => {
      const result = service.detect('crear tarea');
      expect(result.intent).toBe('create_task');
      expect(result.toolName).toBe('create_task');
    });

    it('detects client count intent', () => {
      const result = service.detect('¿Cuántos clientes tengo?');
      expect(result.intent).toBe('client_count');
      expect(result.toolName).toBe('get_client_count');
      expect(result.confidence).toBe(1);
      expect(result.detectionMethod).toBe('fast');
    });

    it('detects due tasks intent', () => {
      const result = service.detect('¿Qué tareas vencen hoy?');
      expect(result.intent).toBe('due_tasks');
      expect(result.toolName).toBe('get_due_tasks');
      expect(result.confidence).toBe(1);
    });

    it('detects activity week intent', () => {
      const result = service.detect('Resumime la actividad de esta semana');
      expect(result.intent).toBe('activity_week');
      expect(result.toolName).toBe('get_activity_week');
      expect(result.confidence).toBe(1);
    });

    it('detects dashboard metrics intent', () => {
      const result = service.detect('métricas del dashboard');
      expect(result.intent).toBe('dashboard_metrics');
      expect(result.toolName).toBe('get_dashboard_metrics');
      expect(result.confidence).toBe(1);
    });

    it('detects open opportunities with "siguen abiertas"', () => {
      const result = service.detect('¿Qué oportunidades siguen abiertas?');
      expect(result.intent).toBe('open_opportunities');
      expect(result.toolName).toBe('get_open_opportunities');
      expect(result.confidence).toBe(1);
    });

    it('detects client full profile intent', () => {
      const result = service.detect('¿Qué sabes del cliente ACME?');
      expect(result.intent).toBe('client_full_profile');
      expect(result.toolName).toBe('get_client_full_profile');
      expect(result.params.clientName).toBe('ACME?');
      expect(result.confidence).toBe(1);
    });

    it('detects client deals intent', () => {
      const result = service.detect('¿Cómo va la oportunidad de ACME?');
      expect(result.intent).toBe('client_deals');
      expect(result.toolName).toBe('get_client_deals');
      expect(result.params.clientName).toBe('ACME?');
      expect(result.confidence).toBe(1);
    });

    it('detects client quotes intent', () => {
      const result = service.detect('Muéstrame los presupuestos de ACME');
      expect(result.intent).toBe('client_quotes');
      expect(result.toolName).toBe('get_client_quotes');
      expect(result.params.clientName).toBe('ACME');
      expect(result.confidence).toBe(1);
    });

    it('detects client tasks intent', () => {
      const result = service.detect('¿Qué tareas tiene ACME?');
      expect(result.intent).toBe('client_tasks');
      expect(result.toolName).toBe('get_client_tasks');
      expect(result.params.clientName).toBe('ACME?');
      expect(result.confidence).toBe(1);
    });

    it('detects "quién es" as client profile', () => {
      const result = service.detect('Quién es TechSolutions');
      expect(result.intent).toBe('client_full_profile');
      expect(result.toolName).toBe('get_client_full_profile');
      expect(result.params.clientName).toBe('TechSolutions');
      expect(result.confidence).toBe(1);
    });

    it('returns unknown for gibberish', () => {
      const result = service.detect('xyzzy flurbo garplax');
      expect(result.intent).toBe('unknown');
      expect(result.toolName).toBeNull();
      expect(result.confidence).toBeLessThan(0.15);
    });
  });

  describe('slow path', () => {
    it('matches monthly sales for vague query', () => {
      const result = service.detect('cómo van las ventas');
      expect(result.detectionMethod).toBe('slow');
      expect(result.confidence).toBeGreaterThanOrEqual(0.15);
    });

    it('returns low confidence for unrelated input', () => {
      const result = service.detect('zzzzz wwwww');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('matches via slow path when no fast pattern matches', () => {
      const result = service.detect('necesito ver mi pipeline de ventas');
      expect(result.detectionMethod).toBe('slow');
      expect(result.confidence).toBeGreaterThanOrEqual(0.15);
    });
  });
});
