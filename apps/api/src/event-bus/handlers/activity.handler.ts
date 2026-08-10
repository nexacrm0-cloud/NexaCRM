import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@nexa/database';
import type { DomainEvent } from '@nexa/domain';

@Injectable()
export class ActivityHandler {
  constructor(private prisma: PrismaService) {}

  @OnEvent('client.created')
  @OnEvent('client.updated')
  @OnEvent('client.deleted')
  async handleClientEvent(event: DomainEvent) {
    const descriptions: Record<string, string> = {
      'client.created': `Cliente "${String(event.payload.companyName ?? '')}" creado`,
      'client.updated': `Cliente "${String(event.payload.companyName ?? '')}" actualizado`,
      'client.deleted': `Cliente "${String(event.payload.companyName ?? '')}" eliminado`,
    };

    await this.prisma.activityLog.create({
      data: {
        type: this.mapEventToActivityType(event.eventName) as any,
        description: descriptions[event.eventName] ?? 'Cliente modificado',
        organizationId: event.metadata.organizationId,
        userId: event.metadata.userId,
        clientId: 'clientId' in event.payload ? (event.payload.clientId as string) : undefined,
      },
    });
  }

  @OnEvent('deal.created')
  @OnEvent('deal.updated')
  @OnEvent('deal.moved')
  @OnEvent('deal.deleted')
  async handleDealEvent(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const descriptions: Record<string, string> = {
      'deal.created': `Oportunidad "${String(payload.title ?? '')}" creada`,
      'deal.updated': `Oportunidad "${String(payload.title ?? '')}" actualizada`,
      'deal.moved': `Oportunidad "${String(payload.title ?? '')}" movida de "${String(payload.previousStageName ?? '')}" a "${String(payload.stageName ?? '')}"`,
      'deal.deleted': `Oportunidad "${String(payload.title ?? '')}" eliminada`,
    };

    await this.prisma.activityLog.create({
      data: {
        type: this.mapEventToActivityType(event.eventName) as any,
        description: descriptions[event.eventName] ?? 'Oportunidad modificada',
        organizationId: event.metadata.organizationId,
        userId: event.metadata.userId,
        dealId: 'dealId' in payload ? (payload.dealId as string) : undefined,
      },
    });
  }

  @OnEvent('task.created')
  @OnEvent('task.updated')
  @OnEvent('task.completed')
  @OnEvent('task.deleted')
  async handleTaskEvent(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const descriptions: Record<string, string> = {
      'task.created': `Tarea "${String(payload.title ?? '')}" creada`,
      'task.updated': `Tarea "${String(payload.title ?? '')}" actualizada`,
      'task.completed': `Tarea "${String(payload.title ?? '')}" completada`,
      'task.deleted': `Tarea "${String(payload.title ?? '')}" eliminada`,
    };

    await this.prisma.activityLog.create({
      data: {
        type: this.mapEventToActivityType(event.eventName) as any,
        description: descriptions[event.eventName] ?? 'Tarea modificada',
        organizationId: event.metadata.organizationId,
        userId: event.metadata.userId,
        taskId: 'taskId' in payload ? (payload.taskId as string) : undefined,
        clientId: 'clientId' in payload ? (payload.clientId as string) : undefined,
        dealId: 'dealId' in payload ? (payload.dealId as string) : undefined,
      },
    });
  }

  @OnEvent('quote.created')
  @OnEvent('quote.sent')
  @OnEvent('quote.accepted')
  @OnEvent('quote.rejected')
  @OnEvent('quote.deleted')
  async handleQuoteEvent(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const descriptions: Record<string, string> = {
      'quote.created': `Presupuesto ${String(payload.number ?? '')} creado`,
      'quote.sent': `Presupuesto ${String(payload.number ?? '')} enviado al cliente`,
      'quote.accepted': `Presupuesto ${String(payload.number ?? '')} aceptado`,
      'quote.rejected': `Presupuesto ${String(payload.number ?? '')} rechazado`,
      'quote.deleted': `Presupuesto ${String(payload.number ?? '')} eliminado`,
    };

    await this.prisma.activityLog.create({
      data: {
        type: this.mapEventToActivityType(event.eventName) as any,
        description: descriptions[event.eventName] ?? 'Presupuesto modificado',
        organizationId: event.metadata.organizationId,
        userId: event.metadata.userId,
        quoteId: 'quoteId' in payload ? (payload.quoteId as string) : undefined,
        clientId: 'clientId' in payload ? (payload.clientId as string) : undefined,
      },
    });
  }

  @OnEvent('event.created')
  @OnEvent('event.updated')
  @OnEvent('event.deleted')
  async handleEventEvent(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const descriptions: Record<string, string> = {
      'event.created': `Evento "${String(payload.title ?? '')}" creado`,
      'event.updated': `Evento "${String(payload.title ?? '')}" actualizado`,
      'event.deleted': `Evento "${String(payload.title ?? '')}" eliminado`,
    };

    await this.prisma.activityLog.create({
      data: {
        type: 'UPDATED',
        description: descriptions[event.eventName] ?? 'Evento modificado',
        organizationId: event.metadata.organizationId,
        userId: event.metadata.userId,
      },
    });
  }

  @OnEvent('invoice.issued')
  async handleInvoiceIssued(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    await this.prisma.activityLog.create({
      data: {
        type: 'UPDATED',
        description: `Factura ${String(payload.number ?? '')} emitida`,
        organizationId: event.metadata.organizationId,
        userId: event.metadata.userId,
      },
    });
  }

  private mapEventToActivityType(eventName: string): string {
    const map: Record<string, string> = {
      'client.created': 'CREATED',
      'client.updated': 'UPDATED',
      'client.deleted': 'DELETED',
      'deal.created': 'CREATED',
      'deal.updated': 'UPDATED',
      'deal.moved': 'STATUS_CHANGED',
      'deal.deleted': 'DELETED',
      'task.created': 'CREATED',
      'task.updated': 'UPDATED',
      'task.completed': 'UPDATED',
      'task.deleted': 'DELETED',
      'quote.created': 'QUOTE_GENERATED',
      'quote.sent': 'EMAIL_SENT',
      'quote.accepted': 'UPDATED',
      'quote.rejected': 'UPDATED',
      'quote.deleted': 'DELETED',
    };
    return map[eventName] ?? 'UPDATED';
  }
}
