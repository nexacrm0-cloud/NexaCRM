import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { createToolDefinitions } from '../tool-registry/tools';
import { IntentDetectionService } from '../intent-detection/intent-detection.service';
import { EventBusService } from '../event-bus/event-bus.service';

const mockPrisma = {
  client: {
    count: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  deal: {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  task: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  quote: {
    findMany: jest.fn(),
  },
  activityLog: {
    findMany: jest.fn(),
  },
  dashboardProjection: {
    findUnique: jest.fn(),
  },
  searchIndex: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockEventBus = { emit: jest.fn() } as unknown as EventBusService;

const mockUser = { id: 'user-1', organizationId: 'org-1', role: 'admin', email: 'admin@test.com' };

function setupToolRegistryAndIntent() {
  const toolRegistry = new ToolRegistryService();
  const tools = createToolDefinitions(mockPrisma as any, mockEventBus);
  for (const tool of tools) {
    toolRegistry.register(tool);
  }
  const intentDetection = new IntentDetectionService(toolRegistry);
  return { toolRegistry, intentDetection, tools };
}

describe('Commercial Flow - Tool Registry', () => {
  it('has 18 tools registered', () => {
    const { tools } = setupToolRegistryAndIntent();
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_client_full_profile');
    expect(names).toContain('get_client_deals');
    expect(names).toContain('get_client_quotes');
    expect(names).toContain('get_client_tasks');
    expect(names).toContain('create_client');
    expect(names).toContain('create_task');
    expect(names).toContain('get_open_opportunities');
    expect(names).toContain('get_dashboard_metrics');
    expect(names).toContain('global_search');
    expect(tools).toHaveLength(30);
  });
});

describe('Commercial Flow - Intent Detection', () => {
  it('detects commercial flow queries', () => {
    const { intentDetection } = setupToolRegistryAndIntent();

    const clientFullProfile = intentDetection.detect('¿Qué sabes del cliente TechSolutions?');
    expect(clientFullProfile.intent).toBe('client_full_profile');
    expect(clientFullProfile.params.clientName).toContain('TechSolutions');

    const clientDeals = intentDetection.detect('¿Cómo va la oportunidad de TechSolutions?');
    expect(clientDeals.intent).toBe('client_deals');

    const clientQuotes = intentDetection.detect('Muéstrame los presupuestos de TechSolutions');
    expect(clientQuotes.intent).toBe('client_quotes');

    const clientTasks = intentDetection.detect('¿Qué tareas tiene TechSolutions?');
    expect(clientTasks.intent).toBe('client_tasks');

    const createClient = intentDetection.detect('crear un nuevo cliente');
    expect(createClient.intent).toBe('create_client');

    const dashboardMetrics = intentDetection.detect('métricas del dashboard');
    expect(dashboardMetrics.intent).toBe('dashboard_metrics');

    const search = intentDetection.detect('buscar TechSolutions');
    expect(search.intent).toBe('global_search');
  });
});

describe('Commercial Flow - Tool Execution', () => {
  it('get_client_full_profile returns client with relations', async () => {
    const { toolRegistry } = setupToolRegistryAndIntent();

    mockPrisma.client.findFirst.mockResolvedValue({
      id: 'client-1',
      companyName: 'TechSolutions',
      contactName: 'Juan Pérez',
      email: 'juan@techsolutions.com',
      deals: [
        { id: 'deal-1', title: 'Plataforma CRM', value: 15000, stage: { name: 'Negociación' } },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Llamar a Juan',
          status: 'PENDING',
          assignee: { firstName: 'Ana', lastName: 'López' },
        },
      ],
      quotes: [{ id: 'quote-1', number: 'COT-001', total: 15000, status: 'DRAFT', items: [] }],
    });

    const result = await toolRegistry.execute(
      'get_client_full_profile',
      { clientName: 'TechSolutions' },
      {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        permissions: [],
      },
    );

    expect(result.success).toBe(true);
    const data = result.data as {
      companyName: string;
      deals: unknown[];
      tasks: unknown[];
      quotes: unknown[];
    };
    expect(data).toBeDefined();
    expect(data.companyName).toBe('TechSolutions');
    expect(data.deals).toHaveLength(1);
    expect(data.tasks).toHaveLength(1);
    expect(data.quotes).toHaveLength(1);
    expect(result.naturalLanguage).toContain('TechSolutions');
  });

  it('get_client_deals returns deals for a client', async () => {
    const { toolRegistry } = setupToolRegistryAndIntent();

    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1', companyName: 'TechSolutions' });
    mockPrisma.deal.findMany.mockResolvedValue([
      { id: 'deal-1', title: 'Plataforma CRM', value: 15000, stage: { name: 'Negociación' } },
    ]);

    const result = await toolRegistry.execute(
      'get_client_deals',
      { clientName: 'TechSolutions' },
      {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        permissions: [],
      },
    );

    expect(result.success).toBe(true);
    expect(result.data as unknown[]).toHaveLength(1);
    expect(result.naturalLanguage).toContain('TechSolutions');
  });

  it('get_client_quotes returns quotes for a client', async () => {
    const { toolRegistry } = setupToolRegistryAndIntent();

    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1', companyName: 'TechSolutions' });
    mockPrisma.quote.findMany.mockResolvedValue([
      {
        id: 'quote-1',
        number: 'COT-001',
        total: 15000,
        status: 'DRAFT',
        items: [{ description: 'Suscripción anual', quantity: 1, unitPrice: 15000 }],
      },
    ]);

    const result = await toolRegistry.execute(
      'get_client_quotes',
      { clientName: 'TechSolutions' },
      {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        permissions: [],
      },
    );

    expect(result.success).toBe(true);
    expect(result.data as unknown[]).toHaveLength(1);
    expect(result.naturalLanguage).toContain('TechSolutions');
  });

  it('get_client_tasks returns tasks for a client', async () => {
    const { toolRegistry } = setupToolRegistryAndIntent();

    mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1', companyName: 'TechSolutions' });
    mockPrisma.task.findMany.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Llamar a Juan',
        status: 'PENDING',
        priority: 'HIGH',
        assignee: { firstName: 'Ana', lastName: 'López' },
      },
    ]);

    const result = await toolRegistry.execute(
      'get_client_tasks',
      { clientName: 'TechSolutions' },
      {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        permissions: [],
      },
    );

    expect(result.success).toBe(true);
    expect(result.data as unknown[]).toHaveLength(1);
    expect(result.naturalLanguage).toContain('TechSolutions');
  });

  it('get_dashboard_metrics returns projections', async () => {
    const { toolRegistry } = setupToolRegistryAndIntent();

    mockPrisma.dashboardProjection.findUnique.mockResolvedValue({
      monthlySales: 50000,
      newClients: 3,
      openOpportunities: 8,
      pendingTasks: 12,
      wonDeals: [],
    });

    const result = await toolRegistry.execute(
      'get_dashboard_metrics',
      {},
      {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        permissions: [],
      },
    );

    expect(result.success).toBe(true);
    const dashData = result.data as { monthlySales: number; openOpportunities: number };
    expect(dashData.monthlySales).toBe(50000);
    expect(dashData.openOpportunities).toBe(8);
    expect(result.naturalLanguage).toContain('$50.000');
  });

  it('return error for unknown client', async () => {
    const { toolRegistry } = setupToolRegistryAndIntent();

    mockPrisma.client.findFirst.mockResolvedValue(null);

    const result = await toolRegistry.execute(
      'get_client_full_profile',
      { clientName: 'GhostCorp' },
      {
        userId: mockUser.id,
        organizationId: mockUser.organizationId,
        role: mockUser.role,
        permissions: [],
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('GhostCorp');
    expect(result.naturalLanguage).toContain('GhostCorp');
  });
});
