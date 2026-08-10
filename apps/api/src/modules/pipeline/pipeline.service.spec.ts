import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

describe('PipelineService', () => {
  let service: PipelineService;

  const mockTx = {
    deal: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    pipelineStage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const mockPrisma = {
    ...mockTx,
    $transaction: jest.fn((cb: any) => cb(mockTx)),
  };

  const mockEventBus = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
    jest.clearAllMocks();
  });

  describe('getFunnel', () => {
    it('should return funnel data with stage names and deal counts', async () => {
      mockPrisma.pipelineStage.findMany.mockResolvedValue([
        {
          name: 'Prospecting',
          _count: { deals: 3 },
          deals: [{ value: 100 }, { value: 200 }],
          color: '#6366f1',
        },
        { name: 'Negotiation', _count: { deals: 2 }, deals: [{ value: 500 }], color: '#f59e0b' },
      ]);

      const result = await service.getFunnel('org-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ stage: 'Prospecting', deals: 3, value: 300, color: '#6366f1' });
      expect(result[1]).toEqual({ stage: 'Negotiation', deals: 2, value: 500, color: '#f59e0b' });
    });
  });

  describe('getStages', () => {
    it('should return pipeline stages ordered by position', async () => {
      mockPrisma.pipelineStage.findMany.mockResolvedValue([
        { id: 'stage-1', name: 'Prospecting', position: 1 },
        { id: 'stage-2', name: 'Negotiation', position: 2 },
      ]);

      const result = await service.getStages('org-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.pipelineStage.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { position: 'asc' },
      });
    });
  });

  describe('getDeals', () => {
    it('should return deals for an organization', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([{ id: 'deal-1', title: 'Big Sale' }]);

      const result = await service.getDeals('org-1');

      expect(result).toHaveLength(1);
    });

    it('should filter by stageId', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([{ id: 'deal-1' }]);

      await service.getDeals('org-1', { stageId: 'stage-1' });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', stageId: 'stage-1' },
        }),
      );
    });

    it('should filter by search term', async () => {
      mockPrisma.deal.findMany.mockResolvedValue([{ id: 'deal-1' }]);

      await service.getDeals('org-1', { search: 'Big' });

      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: expect.arrayContaining([
              { title: { contains: 'Big', mode: 'insensitive' } },
              { client: { companyName: { contains: 'Big', mode: 'insensitive' } } },
            ]),
          }),
        }),
      );
    });
  });

  describe('getDeal', () => {
    it('should throw NotFoundException if deal not found', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await expect(service.getDeal('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('should return deal with nested relations', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        title: 'Big Deal',
        stage: { name: 'Prospecting' },
        client: { companyName: 'Acme' },
        assignee: { firstName: 'John' },
        tasks: [],
        quotes: [],
        activityLogs: [],
      });

      const result = await service.getDeal('deal-1', 'org-1');
      expect(result.id).toBe('deal-1');
    });
  });

  describe('createDeal', () => {
    const createDto = {
      title: 'New Deal',
      value: 5000,
      stageId: 'stage-1',
      clientId: 'client-1',
      assignedTo: 'user-2',
    };

    it('should throw BadRequestException if stage not found', async () => {
      mockPrisma.pipelineStage.findFirst.mockResolvedValue(null);
      await expect(service.createDeal('org-1', createDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create a deal and emit deal.created event', async () => {
      mockPrisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-1', name: 'Prospecting' });
      mockPrisma.deal.create.mockResolvedValue({
        id: 'deal-1',
        title: 'New Deal',
        value: 5000,
        stageId: 'stage-1',
        clientId: 'client-1',
        stage: { name: 'Prospecting', color: '#6366f1' },
        client: { companyName: 'Acme' },
        assignee: { firstName: 'John', lastName: 'Doe' },
      });

      const result = await service.createDeal('org-1', createDto, 'user-1');

      expect(result.id).toBe('deal-1');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('deal.created');
      expect(emittedEvent.aggregateType).toBe('deal');
      expect(emittedEvent.aggregateId).toBe('deal-1');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({
          dealId: 'deal-1',
          title: 'New Deal',
          value: 5000,
          stageId: 'stage-1',
          stageName: 'Prospecting',
          clientId: 'client-1',
        }),
      );
      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      );
    });
  });

  describe('updateDeal', () => {
    it('should throw NotFoundException if deal not found', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await expect(
        service.updateDeal('bad-id', 'org-1', { title: 'New' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update a deal and emit deal.updated event', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: 'deal-1' });
      mockPrisma.deal.update.mockResolvedValue({
        id: 'deal-1',
        title: 'Updated Deal',
        value: 10000,
        stageId: 'stage-2',
        clientId: 'client-1',
        stage: { name: 'Negotiation', color: '#f59e0b' },
        client: { companyName: 'Acme' },
      });

      const result = await service.updateDeal(
        'deal-1',
        'org-1',
        { title: 'Updated Deal', value: 10000 },
        'user-1',
      );

      expect(result.title).toBe('Updated Deal');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('deal.updated');
      expect(emittedEvent.aggregateId).toBe('deal-1');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ dealId: 'deal-1', title: 'Updated Deal', value: 10000 }),
      );
    });
  });

  describe('moveDeal', () => {
    it('should throw BadRequestException if target stage not found', async () => {
      mockPrisma.pipelineStage.findFirst.mockResolvedValue(null);
      await expect(service.moveDeal('deal-1', 'org-1', 'bad-stage', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should move a deal and emit deals.moved event with previous stage', async () => {
      mockPrisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-2', name: 'Negotiation' });
      mockPrisma.deal.findMany
        .mockResolvedValueOnce([{ id: 'deal-1', stageId: 'stage-1', title: 'Big Deal' }])
        .mockResolvedValueOnce([
          {
            id: 'deal-1',
            title: 'Big Deal',
            stageId: 'stage-2',
            value: 5000,
            currency: 'ARS',
            stage: { name: 'Negotiation' },
          },
        ]);
      mockPrisma.deal.updateMany.mockResolvedValue({ count: 1 });

      await service.moveDeal('deal-1', 'org-1', 'stage-2', 'user-1');

      expect(mockPrisma.deal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['deal-1'] }, organizationId: 'org-1' },
          data: { stageId: 'stage-2' },
        }),
      );

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('deals.moved');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({
          newStageId: 'stage-2',
          newStageName: 'Negotiation',
          dealIds: ['deal-1'],
          previousStatuses: [{ id: 'deal-1', previousStageId: 'stage-1', title: 'Big Deal' }],
        }),
      );
    });
  });

  describe('removeDeal', () => {
    it('should throw NotFoundException if deal not found', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await expect(service.removeDeal('bad-id', 'org-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete and emit deal.deleted event', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        title: 'Big Deal',
      });
      mockPrisma.deal.delete.mockResolvedValue({});

      await service.removeDeal('deal-1', 'org-1', 'user-1');

      expect(mockPrisma.deal.delete).toHaveBeenCalledWith({ where: { id: 'deal-1' } });

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('deal.deleted');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ dealId: 'deal-1', title: 'Big Deal' }),
      );
      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
      );
    });
  });
});
