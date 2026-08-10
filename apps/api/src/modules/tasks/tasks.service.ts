import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import crypto from 'crypto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(
    organizationId: string,
    params: {
      status?: string;
      priority?: string;
      assignedTo?: string;
      page: number;
      limit: number;
    },
  ) {
    const { status, priority, assignedTo, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedTo) where.assignedTo = assignedTo;

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          client: { select: { id: true, companyName: true } },
          deal: { select: { id: true, title: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }

  async create(organizationId: string, data: any, userId: string) {
    const task = await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description || null,
        priority: data.priority || 'MEDIUM',
        status: data.status || 'PENDING',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        assignedTo: data.assignedTo || null,
        clientId: data.clientId || null,
        dealId: data.dealId || null,
        createdById: userId,
        organizationId,
      },
      include: {
        assignee: { select: { firstName: true, lastName: true } },
        client: { select: { companyName: true } },
      },
    });

    this.eventBus.emit({
      eventName: 'task.created',
      aggregateType: 'task',
      aggregateId: task.id,
      payload: {
        taskId: task.id,
        title: task.title,
        status: task.status,
        assignedTo: task.assignedTo,
        clientId: task.clientId,
        dealId: task.dealId,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return task;
  }

  async update(id: string, organizationId: string, data: any, userId: string) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.dueDate !== undefined)
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.reminderAt !== undefined)
      updateData.reminderAt = data.reminderAt ? new Date(data.reminderAt) : null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo || null;
    if (data.clientId !== undefined) updateData.clientId = data.clientId || null;
    if (data.dealId !== undefined) updateData.dealId = data.dealId || null;

    const [task] = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.task.findFirst({
        where: { id, organizationId },
      });
      if (!existing) throw new NotFoundException('Tarea no encontrada');

      const updated = await tx.task.update({
        where: { id },
        data: updateData,
        include: {
          assignee: { select: { firstName: true, lastName: true } },
        },
      });

      return [updated];
    });

    this.eventBus.emit({
      eventName: 'task.updated',
      aggregateType: 'task',
      aggregateId: task.id,
      payload: {
        taskId: task.id,
        title: task.title,
        status: task.status,
        assignedTo: task.assignedTo,
        clientId: task.clientId,
        dealId: task.dealId,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return task;
  }

  async complete(id: string, organizationId: string, userId: string) {
    const [updated] = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: { id, organizationId },
      });
      if (!task) throw new NotFoundException('Tarea no encontrada');

      const completed = await tx.task.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      return [completed];
    });

    this.eventBus.emit({
      eventName: 'task.completed',
      aggregateType: 'task',
      aggregateId: updated.id,
      payload: {
        taskId: updated.id,
        title: updated.title,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return updated;
  }

  async remove(id: string, organizationId: string, userId: string) {
    const [existing] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.task.findFirst({
        where: { id, organizationId },
      });
      if (!found) throw new NotFoundException('Tarea no encontrada');

      await tx.task.delete({ where: { id } });
      return [found];
    });

    this.eventBus.emit({
      eventName: 'task.deleted',
      aggregateType: 'task',
      aggregateId: id,
      payload: {
        taskId: id,
        title: existing.title,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });
  }
}
