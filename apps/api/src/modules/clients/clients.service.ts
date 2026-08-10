import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import crypto from 'crypto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(
    organizationId: string,
    params: { page: number; limit: number; search?: string; prismaSelect?: Record<string, true> },
  ) {
    const { page, limit, search, prismaSelect } = params;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // When the caller passed a ?select= projection we apply it verbatim and
    // DROP the `_count` include because mixed `select` + `include` is not
    // allowed in Prisma. When ?select is absent we keep the legacy shape
    // (which returns `_count` of deals/tasks/quotes for the table view).
    // buildSelect has already validated the projection against an allowlist
    // and a hard denylist of sensitive fields, so passing it straight to
    // Prisma is safe.
    const findManyArgs: any = {
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    };
    if (prismaSelect) {
      findManyArgs.select = prismaSelect;
    } else {
      findManyArgs.include = {
        _count: { select: { deals: true, tasks: true, quotes: true } },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany(findManyArgs),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, organizationId },
      include: {
        deals: {
          include: {
            stage: { select: { name: true, color: true } },
            assignee: { select: { firstName: true, lastName: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        tasks: {
          include: { assignee: { select: { firstName: true, lastName: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        quotes: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        activityLogs: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { deals: true, tasks: true, quotes: true } },
      },
    });

    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(organizationId: string, data: any, userId: string) {
    const client = await this.prisma.client.create({
      data: {
        ...data,
        tags: data.tags || [],
        organizationId,
      },
    });

    this.eventBus.emit({
      eventName: 'client.created',
      aggregateType: 'client',
      aggregateId: client.id,
      payload: {
        clientId: client.id,
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return client;
  }

  async update(id: string, organizationId: string, data: any, userId: string) {
    const [client] = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.client.findFirst({
        where: { id, organizationId },
      });
      if (!existing) throw new NotFoundException('Cliente no encontrado');

      const updated = await tx.client.update({
        where: { id },
        data: {
          ...data,
          tags: data.tags !== undefined ? data.tags : undefined,
        },
      });

      return [updated];
    });

    this.eventBus.emit({
      eventName: 'client.updated',
      aggregateType: 'client',
      aggregateId: client.id,
      payload: {
        clientId: client.id,
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return client;
  }

  async remove(id: string, organizationId: string, userId: string) {
    const [existing] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.client.findFirst({
        where: { id, organizationId },
      });
      if (!found) throw new NotFoundException('Cliente no encontrado');

      await tx.client.delete({ where: { id } });
      return [found];
    });

    this.eventBus.emit({
      eventName: 'client.deleted',
      aggregateType: 'client',
      aggregateId: id,
      payload: {
        clientId: id,
        companyName: existing.companyName,
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
