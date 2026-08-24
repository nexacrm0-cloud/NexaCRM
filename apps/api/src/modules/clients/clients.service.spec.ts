import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

describe('ClientsService', () => {
  let service: ClientsService;

  const mockTx = {
    client: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
        ClientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated clients', async () => {
      mockPrisma.client.findMany.mockResolvedValue([{ id: 'client-1', companyName: 'Acme' }]);
      mockPrisma.client.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by search term', async () => {
      mockPrisma.client.findMany.mockResolvedValue([{ id: 'client-1' }]);
      mockPrisma.client.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', { page: 1, limit: 10, search: 'Acme' });

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: expect.arrayContaining([
              { companyName: { contains: 'Acme', mode: 'insensitive' } },
              { contactName: { contains: 'Acme', mode: 'insensitive' } },
              { email: { contains: 'Acme', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('should return client with relations if found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        companyName: 'Acme Corp',
        deals: [],
        tasks: [],
        quotes: [],
        activityLogs: [],
        _count: { deals: 0, tasks: 0, quotes: 0 },
      });

      const result = await service.findOne('client-1', 'org-1');
      expect(result.id).toBe('client-1');
    });

    // SECURITY: IDOR defense contract. findOne must pass organizationId as
    // part of the Prisma where clause so a tenant cannot read another
    // tenant's client by guessing the UUID. Postgres RLS provides a second
    // layer at the DB level, but the application-level filter is the
    // contract the rest of the code depends on. Pin it here so a future
    // refactor doesn't accidentally drop the filter.
    it('should scope findOne by organizationId (IDOR defense)', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await service.findOne('client-of-org-2', 'org-1').catch(() => undefined);
      const whereArg = mockPrisma.client.findFirst.mock.calls[0][0];
      expect(whereArg.where).toEqual(
        expect.objectContaining({ id: 'client-of-org-2', organizationId: 'org-1' }),
      );
    });
  });

  describe('create', () => {
    const createDto = {
      companyName: 'Acme Corp',
      contactName: 'John Doe',
      email: 'john@acme.com',
      phone: '+525512345678',
    };

    it('should create a client and emit client.created event', async () => {
      mockPrisma.client.create.mockResolvedValue({
        id: 'client-1',
        companyName: 'Acme Corp',
        contactName: 'John Doe',
        email: 'john@acme.com',
        phone: '+525512345678',
        tags: [],
      });

      const result = await service.create('org-1', createDto, 'user-1');

      expect(result.id).toBe('client-1');
      expect(result.companyName).toBe('Acme Corp');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('client.created');
      expect(emittedEvent.aggregateType).toBe('client');
      expect(emittedEvent.aggregateId).toBe('client-1');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({
          clientId: 'client-1',
          companyName: 'Acme Corp',
          contactName: 'John Doe',
          email: 'john@acme.com',
          phone: '+525512345678',
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
  });

  describe('update', () => {
    it('should throw NotFoundException if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(
        service.update('bad-id', 'org-1', { companyName: 'New' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update a client and emit client.updated event', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1' });
      mockPrisma.client.update.mockResolvedValue({
        id: 'client-1',
        companyName: 'New Corp',
        contactName: 'Jane Doe',
        email: 'jane@acme.com',
        phone: '+525598765432',
        tags: [],
      });

      const result = await service.update(
        'client-1',
        'org-1',
        { companyName: 'New Corp' },
        'user-1',
      );

      expect(result.companyName).toBe('New Corp');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('client.updated');
      expect(emittedEvent.aggregateId).toBe('client-1');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ clientId: 'client-1', companyName: 'New Corp' }),
      );
      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad-id', 'org-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete and emit client.deleted event', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'client-1',
        companyName: 'Acme Corp',
      });
      mockPrisma.client.delete.mockResolvedValue({});

      await service.remove('client-1', 'org-1', 'user-1');

      expect(mockPrisma.client.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('client.deleted');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ clientId: 'client-1', companyName: 'Acme Corp' }),
      );
      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
      );
    });
  });
});
