import { CommandCenterService } from '../command-center.service';
import { ToolRegistryService } from '../../tool-registry/tool-registry.service';
import { IntentDetectionService } from '../../intent-detection/intent-detection.service';
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
      .mockResolvedValue({
        success: true,
        data: { result: 'ok' },
        naturalLanguage: 'Ejecutado exitosamente',
      }),
  };
}

describe('CommandCenterService', () => {
  let toolRegistry: ToolRegistryService;
  let intentDetection: IntentDetectionService;
  let service: CommandCenterService;
  const context: ToolContext = {
    userId: 'u1',
    organizationId: 'o1',
    role: 'admin',
    permissions: [],
  };

  beforeEach(() => {
    toolRegistry = new ToolRegistryService();
    toolRegistry.register(
      mockTool('get_monthly_sales', 'Obtener ventas del mes', ['ventas', 'mes']),
    );
    toolRegistry.register(
      mockTool('get_dashboard_summary', 'Resumen del dashboard', ['dashboard']),
    );
    intentDetection = new IntentDetectionService(toolRegistry);
    service = new CommandCenterService(toolRegistry, intentDetection);
  });

  it('executes a known command via fast path', async () => {
    const result = await service.execute('ventas del mes', context);
    expect(result.success).toBe(true);
    expect(result.intent).toBe('monthly_sales');
    expect(result.action).toBe('get_monthly_sales');
    expect(result.detectionMethod).toBe('fast');
    expect(result.confidence).toBe(1);
  });

  it('handles navigation commands', async () => {
    const result = await service.execute('ir a clientes', context);
    expect(result.success).toBe(true);
    expect(result.intent).toBe('navigate');
    expect(result.navigation).toEqual({ path: '/clients', label: 'Clientes' });
  });

  it('returns error for unknown navigation destination', async () => {
    const result = await service.execute('ir a nonexistent', context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown navigation');
  });

  it('returns failure for unknown commands', async () => {
    const result = await service.execute('xyzzy flurbo', context);
    expect(result.success).toBe(false);
    expect(result.intent).toBe('unknown');
  });

  it('includes executionTimeMs in result', async () => {
    const result = await service.execute('ventas del mes', context);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles tool execution errors gracefully', async () => {
    const failingTool: ToolDefinition = {
      ...mockTool('failing_tool', 'Failing tool', ['fail']),
      handler: jest.fn().mockRejectedValue(new Error('internal error')),
    };
    toolRegistry.register(failingTool);
    const result = await service.execute('fail test', context);
    expect(result.success).toBe(false);
    expect(result.error).toBe('internal error');
  });
});
