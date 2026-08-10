import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

describe('TasksService', () => {
  let service: TasksService;

  const mockTx = {
    task: {
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
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1', title: 'Test' }]);
      mockPrisma.task.count.mockResolvedValue(1);

      const result = await service.findAll('org-1', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1' }]);
      mockPrisma.task.count.mockResolvedValue(1);

      await service.findAll('org-1', { status: 'PENDING', page: 1, limit: 10 });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'PENDING' },
        }),
      );
    });

    it('should filter by priority', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1' }]);
      mockPrisma.task.count.mockResolvedValue(1);

      await service.findAll('org-1', { priority: 'HIGH', page: 1, limit: 10 });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', priority: 'HIGH' },
        }),
      );
    });

    it('should filter by assignedTo', async () => {
      mockPrisma.task.findMany.mockResolvedValue([{ id: 'task-1' }]);
      mockPrisma.task.count.mockResolvedValue(1);

      await service.findAll('org-1', { assignedTo: 'user-1', page: 1, limit: 10 });

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', assignedTo: 'user-1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('should return task with relations if found', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
        assignee: { id: 'user-1', firstName: 'John' },
        createdBy: { id: 'user-2', firstName: 'Jane' },
        client: { id: 'client-1', companyName: 'Acme' },
        deal: { id: 'deal-1', title: 'Big Deal' },
      });

      const result = await service.findOne('task-1', 'org-1');
      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Test Task');
    });
  });

  describe('create', () => {
    const createDto = {
      title: 'New Task',
      description: 'Task description',
      priority: 'HIGH',
      dueDate: new Date('2026-12-31').toISOString(),
      assignedTo: 'user-2',
      clientId: 'client-1',
      dealId: 'deal-1',
    };

    it('should create a task and emit task.created event', async () => {
      mockPrisma.task.create.mockResolvedValue({
        id: 'task-1',
        title: 'New Task',
        description: 'Task description',
        priority: 'HIGH',
        status: 'PENDING',
        assignedTo: 'user-2',
        clientId: 'client-1',
        dealId: 'deal-1',
      });

      const result = await service.create('org-1', createDto, 'user-1');

      expect(result.id).toBe('task-1');
      expect(result.title).toBe('New Task');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('task.created');
      expect(emittedEvent.aggregateType).toBe('task');
      expect(emittedEvent.aggregateId).toBe('task-1');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({
          taskId: 'task-1',
          title: 'New Task',
          status: 'PENDING',
          assignedTo: 'user-2',
          clientId: 'client-1',
          dealId: 'deal-1',
        }),
      );
      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      );
    });

    it('should default priority to MEDIUM when not provided', async () => {
      mockPrisma.task.create.mockResolvedValue({
        id: 'task-1',
        title: 'Simple Task',
        status: 'PENDING',
      });

      await service.create('org-1', { title: 'Simple Task' }, 'user-1');

      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: 'MEDIUM' }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);
      await expect(service.update('bad-id', 'org-1', { title: 'New' }, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update a task and emit task.updated event', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
      mockPrisma.task.update.mockResolvedValue({
        id: 'task-1',
        title: 'Updated Task',
        status: 'IN_PROGRESS',
        assignedTo: 'user-2',
        clientId: 'client-1',
        dealId: 'deal-1',
      });

      const result = await service.update(
        'task-1',
        'org-1',
        { title: 'Updated Task', status: 'IN_PROGRESS' },
        'user-1',
      );

      expect(result.title).toBe('Updated Task');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('task.updated');
      expect(emittedEvent.aggregateId).toBe('task-1');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ taskId: 'task-1', title: 'Updated Task', status: 'IN_PROGRESS' }),
      );
    });
  });

  describe('complete', () => {
    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);
      await expect(service.complete('bad-id', 'org-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set status to COMPLETED and emit task.completed event', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        title: 'Task',
        status: 'PENDING',
      });
      mockPrisma.task.update.mockResolvedValue({
        id: 'task-1',
        title: 'Task',
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const result = await service.complete('task-1', 'org-1', 'user-1');

      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );

      expect(result.status).toBe('COMPLETED');

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('task.completed');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ taskId: 'task-1', title: 'Task' }),
      );
    });
  });

  describe('remove', () => {
    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad-id', 'org-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should delete and emit task.deleted event', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 'task-1',
        title: 'Task to delete',
      });
      mockPrisma.task.delete.mockResolvedValue({});

      await service.remove('task-1', 'org-1', 'user-1');

      expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });

      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const emittedEvent = mockEventBus.emit.mock.calls[0][0];
      expect(emittedEvent.eventName).toBe('task.deleted');
      expect(emittedEvent.payload).toEqual(
        expect.objectContaining({ taskId: 'task-1', title: 'Task to delete' }),
      );
      expect(emittedEvent.metadata).toEqual(
        expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
      );
    });
  });
});
