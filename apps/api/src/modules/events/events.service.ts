import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import crypto from 'crypto';
import { RRule, Frequency } from 'rrule';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(
    organizationId: string,
    params: { page: number; limit: number; startDate?: string; endDate?: string },
  ) {
    const { page, limit, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, companyName: true } },
          deal: { select: { id: true, title: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    // Expand recurring events
    let allEvents = [...data];
    if (startDate && endDate) {
      const expanded = await this.expandRecurringEvents(
        organizationId,
        new Date(startDate),
        new Date(endDate),
      );
      allEvents = [...data, ...expanded];
    }

    return {
      data: allEvents.sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
      meta: {
        total: allEvents.length,
        page,
        limit,
        totalPages: Math.ceil(allEvents.length / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        task: { select: { id: true, title: true } },
      },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async create(organizationId: string, data: any, userId: string) {
    const event = await this.prisma.event.create({
      data: {
        title: data.title,
        description: data.description || null,
        type: data.type || 'MEETING',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        allDay: data.allDay || false,
        color: data.color || null,
        location: data.location || null,
        clientId: data.clientId || null,
        dealId: data.dealId || null,
        taskId: data.taskId || null,
        organizationId,
        createdById: userId,
        isRecurring: data.isRecurring || false,
        recurrenceRule: data.recurrenceRule || null,
        recurringEventId: data.recurringEventId || null,
        recurrenceException: data.recurrenceException || null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        task: { select: { id: true, title: true } },
      },
    });

    this.eventBus.emit({
      eventName: 'event.created',
      aggregateType: 'event',
      aggregateId: event.id,
      payload: {
        eventId: event.id,
        title: event.title,
        type: event.type,
        startDate: event.startDate,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return event;
  }

  async update(id: string, organizationId: string, data: any, userId: string) {
    const existing = await this.prisma.event.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Evento no encontrado');

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.allDay !== undefined && { allDay: data.allDay }),
        ...(data.color !== undefined && { color: data.color || null }),
        ...(data.location !== undefined && { location: data.location || null }),
        ...(data.clientId !== undefined && { clientId: data.clientId || null }),
        ...(data.dealId !== undefined && { dealId: data.dealId || null }),
        ...(data.taskId !== undefined && { taskId: data.taskId || null }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
        ...(data.recurrenceRule !== undefined && { recurrenceRule: data.recurrenceRule || null }),
        ...(data.recurringEventId !== undefined && {
          recurringEventId: data.recurringEventId || null,
        }),
        ...(data.recurrenceException !== undefined && {
          recurrenceException: data.recurrenceException || null,
        }),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, companyName: true } },
        deal: { select: { id: true, title: true } },
        task: { select: { id: true, title: true } },
      },
    });

    this.eventBus.emit({
      eventName: 'event.updated',
      aggregateType: 'event',
      aggregateId: event.id,
      payload: { eventId: event.id, title: event.title },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return event;
  }

  async remove(id: string, organizationId: string, userId: string) {
    const existing = await this.prisma.event.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Evento no encontrado');

    await this.prisma.event.delete({ where: { id } });

    this.eventBus.emit({
      eventName: 'event.deleted',
      aggregateType: 'event',
      aggregateId: id,
      payload: { eventId: id },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return { success: true, message: 'Evento eliminado' };
  }

  private expandRecurringEvents(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any[]> {
    return this.prisma.event
      .findMany({
        where: {
          organizationId,
          isRecurring: true,
          recurrenceRule: { not: null },
          startDate: { lte: endDate },
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, companyName: true } },
          deal: { select: { id: true, title: true } },
          task: { select: { id: true, title: true } },
        },
      })
      .then((events) => {
        const expanded: any[] = [];
        for (const event of events) {
          if (!event.recurrenceRule) continue;
          try {
            const rule = RRule.fromString(event.recurrenceRule);
            const occurrences = rule.between(startDate, endDate, true);
            for (const occurrence of occurrences) {
              const exceptionDates =
                event.recurrenceException?.split(',').map((d) => new Date(d.trim()).getTime()) ||
                [];
              if (exceptionDates.includes(occurrence.getTime())) continue;
              expanded.push({
                ...event,
                id: `${event.id}_${occurrence.getTime()}`,
                startDate: occurrence,
                endDate: new Date(
                  occurrence.getTime() +
                    (new Date(event.endDate).getTime() - new Date(event.startDate).getTime()),
                ),
                recurringEventId: event.id,
              });
            }
          } catch (e) {
            console.error('Error expanding recurring event:', event.id, e);
          }
        }
        return expanded;
      });
  }
}
