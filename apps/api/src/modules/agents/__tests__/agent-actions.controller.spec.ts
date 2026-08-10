import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AgentActionsController } from '../agent-actions.controller';
import { PrismaService } from '@nexa/database';
import { AgentApiKeyGuard } from '../../../common/guards/agent-api-key.guard';
import { agentSearchClientQuerySchema } from '@nexa/shared';

describe('AgentActionsController', () => {
  let controller: AgentActionsController;

  const mockCreatedClient = {
    id: 'client_1',
    companyName: 'Acme SA',
    contactName: '',
    email: '',
    phone: '5491133221100',
    address: '',
    tags: [],
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    organizationId: 'org_1',
  };

  const mockCreatedDeal = {
    id: 'deal_1',
    title: 'Venta nuevo',
    value: 0,
    currency: 'USD',
    stageId: 'stage_1',
    clientId: null,
    organizationId: 'org_1',
    notes: '',
    assignedTo: null,
    probability: 10,
  };

  const mockCreatedTask = {
    id: 'task_1',
    title: 'Tarea de seguimiento',
    description: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    dueDate: null,
    clientId: null,
    dealId: null,
    assignedTo: null,
    createdById: null,
    organizationId: 'org_1',
  };

  const mockPrisma = {
    client: {
      create: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve({ ...mockCreatedClient, ...args.data, id: 'client_new' }),
        ),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    pipelineStage: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'stage_1', position: 0, organizationId: 'org_1' }),
    },
    deal: {
      create: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve({ ...mockCreatedDeal, ...args.data, id: 'deal_new' }),
        ),
    },
    task: {
      create: jest
        .fn()
        .mockImplementation((args: any) =>
          Promise.resolve({ ...mockCreatedTask, ...args.data, id: 'task_new' }),
        ),
    },
    quote: {
      create: jest.fn().mockResolvedValue({ id: 'q1', items: [] }),
    },
    $queryRaw: jest.fn(),
  };

  const mockGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentActionsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    })
      .overrideGuard(AgentApiKeyGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AgentActionsController>(AgentActionsController);
    jest.clearAllMocks();
  });

  it('creates a client', async () => {
    const req = { organizationId: 'org_1' };
    const result = await controller.createClient(req as any, {
      companyName: 'Acme SA',
      phone: '5491133221100',
    });
    expect(result.success).toBe(true);
    expect(result.client.organizationId).toBe('org_1');
    expect(mockPrisma.client.create).toHaveBeenCalled();
  });

  it('uses defaults for missing optional fields', async () => {
    const req = { organizationId: 'org_1' };
    await controller.createClient(req as any, { companyName: 'X' });

    const call = mockPrisma.client.create.mock.calls[0][0];
    expect(call.data.contactName).toBe('');
    expect(call.data.email).toBe('');
    expect(call.data.tags).toEqual([]);
    expect(call.data.organizationId).toBe('org_1');
  });

  it('search by phone returns null when no client found', async () => {
    const req = { organizationId: 'org_1' };
    mockPrisma.client.findFirst.mockResolvedValueOnce(null);
    const result = await controller.searchClient(req as any, { phone: '5491133221100' });
    expect(result.success).toBe(true);
    expect(result.client).toBe(null);
  });

  it('search by phone returns the client', async () => {
    const req = { organizationId: 'org_1' };
    mockPrisma.client.findFirst.mockResolvedValueOnce(mockCreatedClient);
    const result = await controller.searchClient(req as any, { phone: '5491133221100' });
    expect(result.client).toEqual(mockCreatedClient);
  });

  it('search requires phone or email (validated by the Zod schema)', () => {
    // The @Query(new ZodPipe(agentSearchClientQuerySchema)) on the controller
    // runs the refine({ phone || email }) at the HTTP boundary. When the
    // controller method is called directly (unit test, no Nest pipe) the
    // guard doesn't run, so we assert against the schema instead.
    expect(agentSearchClientQuerySchema.safeParse({}).success).toBe(false);
    expect(agentSearchClientQuerySchema.safeParse({ phone: '5491133221100' }).success).toBe(true);
    expect(agentSearchClientQuerySchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('creates a deal and picks the first stage when none given', async () => {
    const req = { organizationId: 'org_1' };
    const result = await controller.createDeal(req as any, { title: 'Venta nuevo' });
    expect(result.success).toBe(true);
    expect(mockPrisma.pipelineStage.findFirst).toHaveBeenCalled();
    expect(mockPrisma.deal.create).toHaveBeenCalled();
    const call = mockPrisma.deal.create.mock.calls[0][0];
    expect(call.data.stageId).toBe('stage_1');
  });

  it('createDeal throws when no pipeline stage exists', async () => {
    mockPrisma.pipelineStage.findFirst.mockResolvedValueOnce(null);
    const req = { organizationId: 'org_1' };
    await expect(controller.createDeal(req as any, { title: 'X' })).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.deal.create).not.toHaveBeenCalled();
  });

  it('creates a task with default PENDING status', async () => {
    const req = { organizationId: 'org_1' };
    await controller.createTask(req as any, { title: 'Tarea seguimiento' });
    const call = mockPrisma.task.create.mock.calls[0][0];
    expect(call.data.status).toBe('PENDING');
    expect(call.data.priority).toBe('MEDIUM');
  });
});
