import { AiContextBuilderService } from '../ai-context-builder.service';
import { IntentDetectionService } from '../../../intent-detection/intent-detection.service';
import { ToolRegistryService } from '../../../tool-registry/tool-registry.service';

describe('AiContextBuilderService', () => {
  let service: AiContextBuilderService;
  let mockIntentDetection: jest.Mocked<IntentDetectionService>;
  let mockToolRegistry: jest.Mocked<ToolRegistryService>;
  const mockUser = { id: 'u1', organizationId: 'o1', role: 'admin', email: 'test@test.com' };

  beforeEach(() => {
    mockIntentDetection = {
      detect: jest.fn(),
    } as any;
    mockToolRegistry = {
      execute: jest.fn(),
      getAll: jest.fn(),
      register: jest.fn(),
      findByName: jest.fn(),
      findByIntent: jest.fn(),
      findByCategory: jest.fn(),
    } as any;
    service = new AiContextBuilderService(mockIntentDetection, mockToolRegistry);
  });

  it('returns context with tool result for a known query', async () => {
    mockIntentDetection.detect
      .mockReturnValueOnce({
        intent: 'client_count',
        confidence: 1,
        toolName: 'get_client_count',
        params: {},
        detectionMethod: 'fast',
        originalInput: 'cuantos clientes tengo',
      })
      .mockReturnValueOnce({
        intent: 'dashboard_metrics',
        confidence: 1,
        toolName: 'get_dashboard_metrics',
        params: {},
        detectionMethod: 'fast',
        originalInput: 'dashboard metrics',
      });

    mockToolRegistry.execute.mockResolvedValueOnce({
      success: true,
      data: { total: 15 },
      naturalLanguage: 'Tienes 15 clientes registrados',
    });
    mockToolRegistry.execute.mockResolvedValueOnce({
      success: true,
      data: { monthlySales: 50000, newClients: 3, openOpportunities: 8, pendingTasks: 12 },
      naturalLanguage:
        'Ventas del mes: $50,000, 3 nuevos clientes, 8 oportunidades abiertas, 12 tareas pendientes',
    });

    const result = await service.buildContext('cuantos clientes tengo', mockUser as any);

    expect(result.query).toBe('cuantos clientes tengo');
    expect(result.intent).toBe('client_count');
    expect(result.data.toolResult).toEqual({ total: 15 });
    expect(result.data.dashboardMetrics).toEqual({
      monthlySales: 50000,
      newClients: 3,
      openOpportunities: 8,
      pendingTasks: 12,
    });
    expect(result.naturalLanguage).toContain('Tienes 15');
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles unknown intents gracefully', async () => {
    mockIntentDetection.detect
      .mockReturnValueOnce({
        intent: 'unknown',
        confidence: 0,
        toolName: null,
        params: { original: 'blah blah' },
        detectionMethod: 'slow',
        originalInput: 'blah blah',
      })
      .mockReturnValueOnce({
        intent: 'dashboard_metrics',
        confidence: 1,
        toolName: 'get_dashboard_metrics',
        params: {},
        detectionMethod: 'fast',
        originalInput: 'dashboard metrics',
      });

    mockToolRegistry.execute.mockResolvedValueOnce({
      success: true,
      data: { monthlySales: 0, newClients: 0, openOpportunities: 0, pendingTasks: 0 },
      naturalLanguage: 'No hay datos disponibles',
    });

    const result = await service.buildContext('blah blah', mockUser as any);

    expect(result.intent).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.data.toolResult).toBeUndefined();
  });

  it('includes dashboard metrics even for non-dashboard queries', async () => {
    mockIntentDetection.detect
      .mockReturnValueOnce({
        intent: 'client_count',
        confidence: 1,
        toolName: 'get_client_count',
        params: {},
        detectionMethod: 'fast',
        originalInput: 'cuantos clientes hay',
      })
      .mockReturnValueOnce({
        intent: 'dashboard_metrics',
        confidence: 1,
        toolName: 'get_dashboard_metrics',
        params: {},
        detectionMethod: 'fast',
        originalInput: 'dashboard metrics',
      });

    mockToolRegistry.execute.mockResolvedValueOnce({
      success: true,
      data: { total: 25 },
      naturalLanguage: 'Tienes 25 clientes registrados',
    });
    mockToolRegistry.execute.mockResolvedValueOnce({
      success: true,
      data: { monthlySales: 100000 },
      naturalLanguage: 'Ventas del mes: $100,000',
    });

    const result = await service.buildContext('cuantos clientes hay', mockUser as any);

    expect(result.data.toolResult).toEqual({ total: 25 });
    expect(result.data.dashboardMetrics).toEqual({ monthlySales: 100000 });
    expect(result.naturalLanguage).toContain('25 clientes');
    expect(result.naturalLanguage).toContain('100,000');
  });
});
