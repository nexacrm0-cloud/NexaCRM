import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AgentsService } from '../agents.service';
import { PrismaService } from '@nexa/database';
import { NotificationsService } from '../../notifications/notifications.service';

describe('AgentsService', () => {
  let service: AgentsService;

  const mockAgent = {
    id: 'agent-whatsapp-ai',
    name: 'whatsapp_ai',
    displayName: 'Asistente WhatsApp',
    requiredPlan: 'pro',
    webhookUrl: 'http://localhost:5678/webhook/whatsapp-ai-agent',
    workflowUrl: null,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockAgentSubscription = {
    id: 'sub_1',
    organizationId: 'org_1',
    agentId: 'agent-whatsapp-ai',
    apiKey: 'ag_original_key',
    isActive: true,
    activatedAt: new Date(),
    deactivatedAt: null,
  };

  const mockAgentExecution = {
    id: 'exec_1',
    status: 'RUNNING',
    input: {},
    startedAt: new Date(),
  };

  const mockPrisma = {
    agent: {
      findUnique: jest.fn().mockResolvedValue(mockAgent),
      findMany: jest.fn().mockResolvedValue([mockAgent]),
    },
    organization: {
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (args?.where?.id === 'org_pro') return Promise.resolve({ plan: 'pro' });
        if (args?.where?.id === 'org_free') return Promise.resolve({ plan: 'free' });
        return Promise.resolve({ plan: 'free' });
      }),
    },
    agentSubscription: {
      findUnique: jest.fn().mockImplementation((args: any) => {
        if (
          args?.where?.organizationId_agentId?.agentId === 'agent-whatsapp-ai' &&
          args?.where?.organizationId_agentId?.organizationId === 'org_pro'
        ) {
          return Promise.resolve(mockAgentSubscription);
        }
        return Promise.resolve(null);
      }),
      findFirst: jest.fn().mockResolvedValue(mockAgentSubscription),
      findMany: jest.fn().mockResolvedValue([mockAgentSubscription]),
      create: jest.fn().mockImplementation((args: any) =>
        Promise.resolve({
          id: 'sub_new',
          organizationId: args.data.organizationId,
          agentId: args.data.agentId,
          apiKey: 'ag_newly_created',
          isActive: true,
          activatedAt: new Date(),
          deactivatedAt: null,
        }),
      ),
      update: jest.fn().mockImplementation((args: any) => ({
        ...mockAgentSubscription,
        ...args.data,
      })),
    },
    agentExecution: {
      findUnique: jest.fn().mockResolvedValue(mockAgentExecution),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockAgentExecution),
      update: jest.fn().mockImplementation((args: any) => ({
        ...mockAgentExecution,
        ...args.data,
      })),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit_1' }),
    },
  };

  const mockNotifications = {
    sendAgentNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();
    service = module.get<AgentsService>(AgentsService);
    jest.clearAllMocks();
  });

  it('rejects activation when org plan is below requiredPlan', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({ plan: 'free' });

    await expect(service.activateAgent('org_free', 'agent-whatsapp-ai')).rejects.toThrow(
      ForbiddenException,
    );

    expect(mockPrisma.agent.findUnique).toHaveBeenCalledWith({
      where: { id: 'agent-whatsapp-ai' },
    });
  });

  it('activates the agent when plan is sufficient', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({ plan: 'pro' });
    // No existing subscription — exercise the create path
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(null);

    const result = await service.activateAgent('org_pro', 'agent-whatsapp-ai');
    expect(result).toBeDefined();
    expect(result.organizationId).toBe('org_pro');
    expect(result.agentId).toBe('agent-whatsapp-ai');
    expect(mockPrisma.agentSubscription.create).toHaveBeenCalled();
  });

  it('returns existing subscription on re-activate', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce({ plan: 'pro' });
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce({
      ...mockAgentSubscription,
      organizationId: 'org_pro',
      isActive: true,
    });

    const result = await service.activateAgent('org_pro', 'agent-whatsapp-ai');
    expect(result.apiKey).toBe('ag_original_key');
    expect(mockPrisma.agentSubscription.create).not.toHaveBeenCalled();
  });

  it('deactivates an active agent', async () => {
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(mockAgentSubscription);

    const result = await service.deactivateAgent('org_pro', 'agent-whatsapp-ai');
    expect(result.isActive).toBe(false);
    expect(mockPrisma.agentSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { isActive: false, deactivatedAt: expect.any(Date) },
    });
  });

  it('throws NotFound when deactivating an absent subscription', async () => {
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(null);
    await expect(service.deactivateAgent('org_pro', 'agent-whatsapp-ai')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFound for unknown agent', async () => {
    mockPrisma.agent.findUnique.mockResolvedValueOnce(null);
    await expect(service.activateAgent('org_pro', 'agent-unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getAgentApiKey returns the key for a subscribed agent', async () => {
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(mockAgentSubscription);

    const result = await service.getAgentApiKey('org_pro', 'agent-whatsapp-ai');
    expect(result.apiKey).toBe('ag_original_key');
    expect(result.isActive).toBe(true);
  });

  it('getAgentApiKey throws when subscription is missing', async () => {
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAgentApiKey('org_pro', 'agent-whatsapp-ai')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('regenerateAgentApiKey creates a new key and updates the row', async () => {
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(mockAgentSubscription);

    const result = await service.regenerateAgentApiKey(
      'org_pro',
      'agent-whatsapp-ai',
      'user_admin',
    );
    expect(result.apiKey).toMatch(/^ag_[a-f0-9]{48}$/);
    expect(result.apiKey).not.toBe('ag_original_key');
    expect(mockPrisma.agentSubscription.update).toHaveBeenCalledWith({
      where: { id: 'sub_1' },
      data: { apiKey: expect.stringMatching(/^ag_[a-f0-9]{48}$/) },
      select: { apiKey: true, isActive: true, agentId: true },
    });
  });

  it('regenerateAgentApiKey writes an audit log', async () => {
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(mockAgentSubscription);

    await service.regenerateAgentApiKey('org_pro', 'agent-whatsapp-ai', 'user_admin');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org_pro',
          userId: 'user_admin',
          eventType: 'agent.api_key.regenerate',
        }),
      }),
    );
  });

  it('regenerateAgentApiKey cannot affect another org even with valid actor', async () => {
    // Si el cliente de otra organización intenta, findUnique retorna null
    // porque la clave compuesta (org_other, whatsapp-ai) no matchea.
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.regenerateAgentApiKey('org_other', 'agent-whatsapp-ai', 'user_attacker'),
    ).rejects.toThrow(NotFoundException);
    expect(mockPrisma.agentSubscription.update).not.toHaveBeenCalled();
  });

  it('getAgentApiKey is scoped by org (returns null without org match)', async () => {
    // Aunque la key existe en otra org, getAgentApiKey debe fallar
    // porque el where es {organizationId_agentId: {organizationId, agentId}}.
    mockPrisma.agentSubscription.findUnique.mockResolvedValueOnce(null);
    await expect(service.getAgentApiKey('org_other', 'agent-whatsapp-ai')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getAvailableAgents returns org-aware list', async () => {
    const result = await service.getAvailableAgents('org_pro');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({
      id: 'agent-whatsapp-ai',
      isSubscribed: true,
      apiKey: 'ag_original_key',
    });
  });
});
