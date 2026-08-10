import { ActivityHandler } from '../activity.handler';
import { AuditHandler } from '../audit.handler';
import { SearchIndexHandler } from '../search-index.handler';
import { DashboardHandler } from '../dashboard.handler';
import { WorkflowHandler } from '../workflow.handler';
import type { DomainEvent } from '@nexa/domain';

const makeEvent = (overrides: Partial<DomainEvent> = {}): DomainEvent => ({
  eventName: 'client.created',
  aggregateType: 'client',
  aggregateId: 'client-1',
  payload: { clientId: 'client-1', companyName: 'Acme Corp', contactName: 'John' },
  metadata: {
    organizationId: 'org-1',
    userId: 'user-1',
    correlationId: 'corr-1',
    timestamp: new Date(),
  },
  ...overrides,
});

describe('ActivityHandler', () => {
  let handler: ActivityHandler;
  const mockPrisma = { activityLog: { create: jest.fn() } };

  beforeEach(() => {
    mockPrisma.activityLog.create.mockReset();
    handler = new ActivityHandler(mockPrisma as any);
  });

  it.each([
    ['client.created', 'CREATED'],
    ['client.updated', 'UPDATED'],
    ['client.deleted', 'DELETED'],
  ])('maps %s to activity type %s', async (eventName, expectedType) => {
    await handler.handleClientEvent(makeEvent({ eventName }));
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: expectedType }),
      }),
    );
  });

  it.each([
    ['deal.created', 'CREATED'],
    ['deal.updated', 'UPDATED'],
    ['deal.moved', 'STATUS_CHANGED'],
    ['deal.deleted', 'DELETED'],
  ])('maps %s to activity type %s', async (eventName, expectedType) => {
    await handler.handleDealEvent(
      makeEvent({
        eventName,
        aggregateType: 'deal',
        aggregateId: 'deal-1',
        payload: { dealId: 'deal-1', title: 'Big Deal', stageName: 'Proposal', value: 1000 },
      }),
    );
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: expectedType }) }),
    );
  });

  it.each([
    ['task.created', 'CREATED'],
    ['task.updated', 'UPDATED'],
    ['task.completed', 'UPDATED'],
    ['task.deleted', 'DELETED'],
  ])('maps %s to activity type %s', async (eventName, expectedType) => {
    await handler.handleTaskEvent(
      makeEvent({
        eventName,
        aggregateType: 'task',
        aggregateId: 'task-1',
        payload: { taskId: 'task-1', title: 'Do it', status: 'PENDING' },
      }),
    );
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: expectedType }) }),
    );
  });

  it.each([
    ['quote.created', 'QUOTE_GENERATED'],
    ['quote.sent', 'EMAIL_SENT'],
    ['quote.accepted', 'UPDATED'],
    ['quote.rejected', 'UPDATED'],
    ['quote.deleted', 'DELETED'],
  ])('maps %s to activity type %s', async (eventName, expectedType) => {
    await handler.handleQuoteEvent(
      makeEvent({
        eventName,
        aggregateType: 'quote',
        aggregateId: 'quote-1',
        payload: {
          quoteId: 'quote-1',
          number: 'COT-00001',
          total: 500,
          clientId: 'client-1',
          status: 'DRAFT',
        },
      }),
    );
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: expectedType }) }),
    );
  });

  it('includes organizationId and userId in the activity log', async () => {
    const event = makeEvent();
    await handler.handleClientEvent(event);
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('creates activity log for client events with description', async () => {
    await handler.handleClientEvent(makeEvent());
    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: expect.stringContaining('Acme Corp') }),
      }),
    );
  });
});

describe('AuditHandler', () => {
  let handler: AuditHandler;
  const mockPrisma = { auditLog: { create: jest.fn() } };

  beforeEach(() => {
    mockPrisma.auditLog.create.mockReset();
    handler = new AuditHandler(mockPrisma as any);
  });

  it('creates an audit log entry for delete events', async () => {
    const event = makeEvent({
      eventName: 'client.deleted',
      aggregateType: 'client',
      aggregateId: 'client-1',
      payload: { clientId: 'client-1', companyName: 'Acme Corp' },
    });
    await handler.handleAuditEvent(event);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'client.deleted',
          entityType: 'client',
          entityId: 'client-1',
          action: 'deleted',
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('extracts action from event name after the dot', async () => {
    await handler.handleAuditEvent(makeEvent({ eventName: 'deal.deleted', aggregateType: 'deal' }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'deleted' }) }),
    );
  });

  it('extracts user.created action correctly', async () => {
    await handler.handleAuditEvent(
      makeEvent({
        eventName: 'user.created',
        aggregateType: 'user',
        aggregateId: 'user-2',
        payload: {
          userId: 'user-2',
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
          role: 'MEMBER',
        },
      }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'created' }) }),
    );
  });

  it('should not throw when prisma fails', async () => {
    mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));
    await expect(
      handler.handleAuditEvent(makeEvent({ eventName: 'client.deleted' })),
    ).resolves.not.toThrow();
  });
});

describe('SearchIndexHandler', () => {
  let handler: SearchIndexHandler;
  const mockPrisma = {
    searchIndex: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new SearchIndexHandler(mockPrisma as any);
  });

  it('creates a search index on client.created', async () => {
    mockPrisma.searchIndex.findFirst.mockResolvedValue(null);
    await handler.handleClientIndex(makeEvent());
    expect(mockPrisma.searchIndex.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'client',
          entityId: 'client-1',
          title: 'Acme Corp',
          organizationId: 'org-1',
        }),
      }),
    );
  });

  it('updates existing search index on client.updated', async () => {
    mockPrisma.searchIndex.findFirst.mockResolvedValue({ id: 'idx-1' });
    await handler.handleClientIndex(makeEvent({ eventName: 'client.updated' }));
    expect(mockPrisma.searchIndex.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'idx-1' } }),
    );
  });

  it('creates search index for deal.created', async () => {
    mockPrisma.searchIndex.findFirst.mockResolvedValue(null);
    await handler.handleDealIndex(
      makeEvent({
        eventName: 'deal.created',
        aggregateType: 'deal',
        aggregateId: 'deal-1',
        payload: {
          dealId: 'deal-1',
          title: 'Big Deal',
          value: 5000,
          stageId: 'stage-1',
          stageName: 'Proposal',
        },
      }),
    );
    expect(mockPrisma.searchIndex.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Big Deal', entityType: 'deal' }),
      }),
    );
  });

  it('creates search index for task.created', async () => {
    mockPrisma.searchIndex.findFirst.mockResolvedValue(null);
    await handler.handleTaskIndex(
      makeEvent({
        eventName: 'task.created',
        aggregateType: 'task',
        aggregateId: 'task-1',
        payload: { taskId: 'task-1', title: 'Follow up', status: 'PENDING' },
      }),
    );
    expect(mockPrisma.searchIndex.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Follow up', entityType: 'task' }),
      }),
    );
  });

  it('creates search index for quote.created', async () => {
    mockPrisma.searchIndex.findFirst.mockResolvedValue(null);
    await handler.handleQuoteIndex(
      makeEvent({
        eventName: 'quote.created',
        aggregateType: 'quote',
        aggregateId: 'quote-1',
        payload: {
          quoteId: 'quote-1',
          number: 'COT-00001',
          total: 1500,
          clientId: 'client-1',
          status: 'DRAFT',
        },
      }),
    );
    expect(mockPrisma.searchIndex.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'COT-00001 - DRAFT', entityType: 'quote' }),
      }),
    );
  });

  it('deletes search index on delete events', async () => {
    await handler.handleDeleteIndex(makeEvent({ eventName: 'client.deleted' }));
    expect(mockPrisma.searchIndex.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'client', entityId: 'client-1', organizationId: 'org-1' },
      }),
    );
  });
});

describe('DashboardHandler', () => {
  let handler: DashboardHandler;
  const mockPrisma = {
    dashboardProjection: { findUnique: jest.fn(), upsert: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new DashboardHandler(mockPrisma as any);
  });

  it('increments newClients on client.created', async () => {
    mockPrisma.dashboardProjection.findUnique.mockResolvedValue(null);
    await handler.handleNewClient(makeEvent());
    expect(mockPrisma.dashboardProjection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        create: expect.objectContaining({ newClients: 1 }),
        update: expect.objectContaining({ newClients: { increment: 1 } }),
      }),
    );
  });

  it('increments openOpportunities on deal.created', async () => {
    mockPrisma.dashboardProjection.findUnique.mockResolvedValue(null);
    await handler.handleNewDeal(makeEvent({ eventName: 'deal.created', aggregateType: 'deal' }));
    expect(mockPrisma.dashboardProjection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ openOpportunities: { increment: 1 } }),
      }),
    );
  });

  it('updates monthlySales and decrements openOpportunities on deal moved to won', async () => {
    mockPrisma.dashboardProjection.findUnique.mockResolvedValue({
      wonDeals: [],
      openOpportunities: 5,
      newClients: 3,
      pendingTasks: 2,
      monthlySales: 0,
    });
    await handler.handleDealMoved(
      makeEvent({
        eventName: 'deal.moved',
        aggregateType: 'deal',
        aggregateId: 'deal-1',
        payload: {
          dealId: 'deal-1',
          title: 'Won Deal',
          value: 10000,
          stageId: 'stage-1',
          stageName: 'Won',
          previousStageName: 'Proposal',
        },
      }),
    );
    expect(mockPrisma.dashboardProjection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        update: expect.objectContaining({
          monthlySales: { increment: 10000 },
          openOpportunities: { decrement: 1 },
        }),
      }),
    );
  });

  it('decrements openOpportunities on deal moved to lost', async () => {
    mockPrisma.dashboardProjection.findUnique.mockResolvedValue({
      openOpportunities: 3,
      newClients: 0,
      pendingTasks: 0,
      monthlySales: 0,
      wonDeals: [],
    });
    await handler.handleDealMoved(
      makeEvent({
        eventName: 'deal.moved',
        aggregateType: 'deal',
        payload: {
          dealId: 'deal-1',
          title: 'Lost Deal',
          value: 5000,
          stageId: 'stage-lost',
          stageName: 'Lost',
          previousStageName: 'Proposal',
        },
      }),
    );
    expect(mockPrisma.dashboardProjection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ openOpportunities: { increment: -1 } }),
      }),
    );
  });

  it('increments pendingTasks on task.created', async () => {
    mockPrisma.dashboardProjection.findUnique.mockResolvedValue(null);
    await handler.handleNewTask(makeEvent({ eventName: 'task.created', aggregateType: 'task' }));
    expect(mockPrisma.dashboardProjection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ pendingTasks: { increment: 1 } }),
      }),
    );
  });

  it('decrements pendingTasks on task.completed', async () => {
    mockPrisma.dashboardProjection.findUnique.mockResolvedValue({
      pendingTasks: 5,
      newClients: 0,
      openOpportunities: 0,
      monthlySales: 0,
      wonDeals: [],
    });
    await handler.handleTaskCompleted(
      makeEvent({ eventName: 'task.completed', aggregateType: 'task' }),
    );
    expect(mockPrisma.dashboardProjection.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ pendingTasks: { increment: -1 } }),
      }),
    );
  });
});

describe('WorkflowHandler', () => {
  let handler: WorkflowHandler;
  const mockPrisma = {
    workflow: { findMany: jest.fn() },
    workflowExecutionLog: { create: jest.fn(), update: jest.fn() },
  };
  const mockExecutor = {
    execute: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WORKFLOWS_ENABLED = 'true';
    mockPrisma.workflowExecutionLog.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: `log-${data.workflowId}` }),
    );
    mockPrisma.workflowExecutionLog.update.mockResolvedValue({});
    mockExecutor.execute.mockResolvedValue({ success: true, output: { status: 'DISPATCHED' } });
    handler = new WorkflowHandler(mockPrisma as any, mockExecutor as any);
  });

  it('queries active workflows matching the event trigger', async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([]);
    await handler.evaluateWorkflows(makeEvent());
    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          isActive: true,
          trigger: 'client.created',
        }),
      }),
    );
  });

  it('creates a workflow execution log for each matching workflow and dispatches via executor', async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([
      { id: 'wf-1', name: 'Welcome Workflow' },
      { id: 'wf-2', name: 'Notify Sales' },
    ]);
    await handler.evaluateWorkflows(makeEvent());
    expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.workflowExecutionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowId: 'wf-1',
          status: 'PENDING',
          triggerType: 'client.created',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(mockExecutor.execute).toHaveBeenCalledTimes(2);
    expect(mockPrisma.workflowExecutionLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('marks log as FAILED when executor returns success=false', async () => {
    mockPrisma.workflow.findMany.mockResolvedValue([{ id: 'wf-1', name: 'Failing' }]);
    mockExecutor.execute.mockResolvedValueOnce({
      success: false,
      output: null,
      error: 'No webhook',
    });
    await handler.evaluateWorkflows(makeEvent());
    expect(mockPrisma.workflowExecutionLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', error: 'No webhook' }),
      }),
    );
  });

  it('handles prisma errors gracefully', async () => {
    mockPrisma.workflow.findMany.mockRejectedValue(new Error('DB error'));
    await expect(handler.evaluateWorkflows(makeEvent())).resolves.not.toThrow();
  });

  it('short-circuits when WORKFLOWS_ENABLED is not "true"', async () => {
    process.env.WORKFLOWS_ENABLED = 'false';
    const disabledHandler = new WorkflowHandler(mockPrisma as any, mockExecutor as any);
    await disabledHandler.evaluateWorkflows(makeEvent());
    expect(mockPrisma.workflow.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.workflowExecutionLog.create).not.toHaveBeenCalled();
    expect(mockExecutor.execute).not.toHaveBeenCalled();
  });
});
