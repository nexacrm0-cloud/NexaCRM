import { ToolRegistryService } from '../tool-registry.service';
import { ToolDefinition } from '../tool.interface';

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;
  const mockTool: ToolDefinition = {
    name: 'test_tool',
    displayName: 'Test Tool',
    description: 'A test tool',
    category: 'CRUD',
    keywords: ['test', 'example'],
    permissions: [],
    inputSchema: { type: 'object', properties: {} },
    handler: jest.fn().mockResolvedValue({ success: true, data: { result: 'ok' } }),
  };

  beforeEach(() => {
    service = new ToolRegistryService();
  });

  it('registers a tool', () => {
    service.register(mockTool);
    expect(service.findByName('test_tool')).toBeDefined();
  });

  it('warns and overwrites on duplicate registration', () => {
    service.register(mockTool);
    service.register({ ...mockTool, description: 'updated' });
    expect(service.findByName('test_tool')?.description).toBe('updated');
  });

  it('returns all tools', () => {
    service.register(mockTool);
    service.register({ ...mockTool, name: 'tool2' });
    expect(service.getAll()).toHaveLength(2);
  });

  it('finds tool by name', () => {
    service.register(mockTool);
    expect(service.findByName('test_tool')?.displayName).toBe('Test Tool');
  });

  it('returns undefined for unknown name', () => {
    expect(service.findByName('nonexistent')).toBeUndefined();
  });

  it('finds tools by intent keyword', () => {
    service.register(mockTool);
    const results = service.findByIntent('example');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('test_tool');
  });

  it('finds tools by category', () => {
    service.register(mockTool);
    service.register({ ...mockTool, name: 'nav_tool', category: 'NAVIGATION' });
    const crudTools = service.findByCategory('CRUD');
    expect(crudTools).toHaveLength(1);
    expect(crudTools[0].name).toBe('test_tool');
  });

  it('executes a tool and returns result with executionTimeMs', async () => {
    service.register(mockTool);
    const result = await service.execute(
      'test_tool',
      {},
      { userId: 'u1', organizationId: 'o1', role: 'admin', permissions: [] },
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ result: 'ok' });
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error for unknown tool', async () => {
    const result = await service.execute(
      'nonexistent',
      {},
      { userId: 'u1', organizationId: 'o1', role: 'admin', permissions: [] },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles handler errors gracefully', async () => {
    const failingTool: ToolDefinition = {
      ...mockTool,
      handler: jest.fn().mockRejectedValue(new Error('oops')),
    };
    service.register(failingTool);
    const result = await service.execute(
      'test_tool',
      {},
      { userId: 'u1', organizationId: 'o1', role: 'admin', permissions: [] },
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('oops');
  });
});
