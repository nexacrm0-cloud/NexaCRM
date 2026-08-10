import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('QuotesService', () => {
  let service: QuotesService;

  const mockTx = {
    client: { findFirst: jest.fn() },
    quote: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    quoteItem: { deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };
  const mockPrisma = {
    ...mockTx,
    $transaction: jest.fn((cb: any) => cb(mockTx)),
  };

  const mockEventBus = {
    emit: jest.fn(),
  };

  const mockNotifications = {
    sendQuoteEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      clientId: 'client-1',
      title: 'Test Quote',
      items: [
        { description: 'Item 1', quantity: 2, unitPrice: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 50 },
      ],
      taxRate: 16,
    };

    it('should throw BadRequestException if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(service.create('org-1', createDto, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create a quote and emit quote.created event', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1', companyName: 'Acme Corp' });
      mockPrisma.$queryRaw.mockResolvedValue([{ nextval: 1 }]);
      mockPrisma.quote.create.mockResolvedValue({
        id: 'quote-1',
        number: 'COT-00001',
        title: 'Test Quote',
        subtotal: 250,
        taxRate: 16,
        taxAmount: 40,
        total: 290,
        clientId: 'client-1',
        items: [
          { description: 'Item 1', quantity: 2, unitPrice: 100, total: 200 },
          { description: 'Item 2', quantity: 1, unitPrice: 50, total: 50 },
        ],
        client: { companyName: 'Acme Corp', contactName: 'John' },
      });

      const result = await service.create('org-1', createDto, 'user-1');

      expect(result.id).toBe('quote-1');
      expect(result.number).toBe('COT-00001');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('quote.created');
      expect(emittedEvent.aggregateType).toBe('quote');
      expect(emittedEvent.aggregateId).toBe('quote-1');

      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({
          quoteId: 'quote-1',
          number: 'COT-00001',
          clientId: 'client-1',
          total: 290,
          status: 'DRAFT',
        }),
      );

      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      );
      expect(emittedEvent.metadata).toHaveProperty('correlationId');
      expect(emittedEvent.metadata).toHaveProperty('timestamp');
      expect(emittedEvent.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should NOT include correlationId or timestamp as static values', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockPrisma.$queryRaw.mockResolvedValue([{ nextval: 2 }]);
      mockPrisma.quote.create.mockResolvedValue({
        id: 'quote-2',
        number: 'COT-00002',
        clientId: 'client-1',
        subtotal: 200,
        taxRate: 0,
        taxAmount: 0,
        total: 200,
        items: [],
      });

      await service.create('org-1', createDto, 'user-1');

      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(typeof emittedEvent.metadata.correlationId).toBe('string');
      expect(emittedEvent.metadata.correlationId.length).toBeGreaterThan(0);
      expect(emittedEvent.metadata.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should return paginated quotes', async () => {
      mockPrisma.quote.findMany.mockResolvedValue([{ id: 'quote-1' }]);
      mockPrisma.quote.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if quote not found', async () => {
      mockPrisma.quote.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('should return the quote if found', async () => {
      mockPrisma.quote.findFirst.mockResolvedValue({ id: 'quote-1', client: {}, createdBy: {} });
      const result = await service.findOne('quote-1', 'org-1');
      expect(result.id).toBe('quote-1');
    });
  });

  describe('send', () => {
    it('should update status to SENT and emit quote.sent', async () => {
      const mockQuote = {
        id: 'quote-1',
        number: 'COT-00001',
        clientId: 'client-1',
        total: 290,
        subtotal: 250,
        taxRate: 16,
        taxAmount: 40,
        status: 'DRAFT',
        validUntil: null,
        notes: null,
        terms: null,
        client: { email: 'client@test.com', contactName: 'Test', companyName: 'Test Corp' },
        createdBy: { firstName: 'Test', lastName: 'User' },
        organization: { name: 'Test Org' },
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
      };
      mockPrisma.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrisma.quote.update.mockResolvedValue({
        id: 'quote-1',
        status: 'SENT',
        sentAt: new Date(),
      });

      await service.send('quote-1', 'org-1', 'user-1');

      expect(mockPrisma.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'quote-1', organizationId: 'org-1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'quote.sent',
          aggregateId: 'quote-1',
          metadata: expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
        }),
      );
    });
  });

  describe('accept', () => {
    it('should update status to ACCEPTED and emit quote.accepted', async () => {
      mockPrisma.quote.findFirst.mockResolvedValue({
        id: 'quote-1',
        number: 'COT-00001',
        clientId: 'client-1',
        status: 'SENT',
      });
      mockPrisma.quote.update.mockResolvedValue({ id: 'quote-1', status: 'ACCEPTED' });

      await service.accept('quote-1', 'org-1', 'user-1');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'quote.accepted',
          payload: { quoteId: 'quote-1', number: 'COT-00001', clientId: 'client-1' },
          metadata: expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
        }),
      );
    });
  });

  describe('reject', () => {
    it('should update status to REJECTED and emit quote.rejected with reason', async () => {
      mockPrisma.quote.findFirst.mockResolvedValue({
        id: 'quote-1',
        number: 'COT-00001',
        clientId: 'client-1',
        status: 'SENT',
      });
      mockPrisma.quote.update.mockResolvedValue({ id: 'quote-1', status: 'REJECTED' });

      await service.reject('quote-1', 'org-1', 'Too expensive', 'user-1');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'quote.rejected',
          payload: {
            quoteId: 'quote-1',
            number: 'COT-00001',
            clientId: 'client-1',
            reason: 'Too expensive',
          },
          metadata: expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete and emit quote.deleted', async () => {
      mockPrisma.quote.findFirst.mockResolvedValue({
        id: 'quote-1',
        number: 'COT-00001',
        status: 'DRAFT',
      });
      mockPrisma.quote.delete.mockResolvedValue({});

      await service.remove('quote-1', 'org-1', 'user-1');

      expect(mockPrisma.quote.delete).toHaveBeenCalledWith({
        where: { id: 'quote-1', organizationId: 'org-1' },
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'quote.deleted',
          payload: { quoteId: 'quote-1', number: 'COT-00001' },
          metadata: expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
        }),
      );
    });
  });
});
