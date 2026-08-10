import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AgentApiKeyGuard } from '../../../common/guards/agent-api-key.guard';

describe('AgentApiKeyGuard', () => {
  let guard: AgentApiKeyGuard;

  const mockSubscription = {
    id: 'sub_1',
    apiKey: 'ag_valid_test_key',
    isActive: true,
    organizationId: 'org_pro',
    agent: { isActive: true, id: 'agent-whatsapp-ai' },
  };

  const mockPrisma = {
    agentSubscription: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        if (where.apiKey === 'ag_valid_test_key') {
          return Promise.resolve(mockSubscription);
        }
        return Promise.resolve(null);
      }),
    },
  };

  beforeEach(() => {
    guard = new AgentApiKeyGuard(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('rejects requests missing the header', async () => {
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
    };
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests with an invalid agent key', async () => {
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-agent-api-key': 'ag_bogus' } }),
      }),
    };
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests with an inactive subscription', async () => {
    mockPrisma.agentSubscription.findFirst.mockResolvedValueOnce({
      ...mockSubscription,
      isActive: false,
    });
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-agent-api-key': 'ag_inactive' } }),
      }),
    };
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects requests with an inactive agent', async () => {
    mockPrisma.agentSubscription.findFirst.mockResolvedValueOnce({
      ...mockSubscription,
      agent: { ...mockSubscription.agent, isActive: false },
    });
    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-agent-api-key': 'ag_agent_inactive' } }),
      }),
    };
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid key and populates request with org/sub', async () => {
    const req: any = {
      headers: { 'x-agent-api-key': 'ag_valid_test_key' },
    };
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => req }),
    };
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.organizationId).toBe('org_pro');
    expect(req.agent.id).toBe('agent-whatsapp-ai');
    expect(req.agentSubscription).toEqual(mockSubscription);
  });
});
