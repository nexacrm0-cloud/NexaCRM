import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@nexa/database';
import type { DomainEvent } from '@nexa/domain';

type NotifDef = {
  title: string;
  message: string;
  link?: string;
  userId?: string;
};

@Injectable()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('task.created')
  async handleTaskCreated(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    if (!p.assignedTo) return;
    await this.create({
      organizationId: event.metadata.organizationId,
      type: 'task.assigned',
      title: 'Nueva tarea asignada',
      message: `Te asignaron la tarea "${String(p.title)}"`,
      link: `/tasks/${String(p.taskId)}`,
      userId: String(p.assignedTo),
    });
  }

  @OnEvent('task.completed')
  async handleTaskCompleted(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    await this.create({
      organizationId: event.metadata.organizationId,
      type: 'task.completed',
      title: 'Tarea completada',
      message: `La tarea "${String(p.title)}" fue completada`,
      link: `/tasks/${String(p.taskId)}`,
      userId: event.metadata.userId,
    });
  }

  @OnEvent('deal.created')
  async handleDealCreated(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    if (p.assignedTo) {
      await this.create({
        organizationId: event.metadata.organizationId,
        type: 'deal.assigned',
        title: 'Nueva oportunidad asignada',
        message: `Te asignaron la oportunidad "${String(p.title)}"`,
        link: `/pipeline/deals/${String(p.dealId)}`,
        userId: String(p.assignedTo),
      });
    }
  }

  @OnEvent('deal.moved')
  async handleDealMoved(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    const stageName = String(p.stageName ?? '');
    const isWon =
      stageName.toLowerCase().includes('won') || stageName.toLowerCase().includes('ganad');
    const isLost =
      stageName.toLowerCase().includes('lost') || stageName.toLowerCase().includes('perdid');
    if (isWon || isLost) {
      await this.create({
        organizationId: event.metadata.organizationId,
        type: isWon ? 'deal.won' : 'deal.lost',
        title: isWon ? 'Oportunidad ganada' : 'Oportunidad perdida',
        message: `La oportunidad "${String(p.title)}" fue ${isWon ? 'ganada' : 'perdida'}`,
        link: `/pipeline/deals/${String(p.dealId)}`,
      });
    }
  }

  @OnEvent('quote.sent')
  async handleQuoteSent(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    await this.create({
      organizationId: event.metadata.organizationId,
      type: 'quote.sent',
      title: 'Presupuesto enviado',
      message: `El presupuesto ${String(p.number)} fue enviado al cliente`,
      link: `/quotes/${String(p.quoteId)}`,
      userId: event.metadata.userId,
    });
  }

  @OnEvent('quote.accepted')
  @OnEvent('quote.rejected')
  async handleQuoteResponse(event: DomainEvent) {
    const p = event.payload as Record<string, unknown>;
    const accepted = event.eventName === 'quote.accepted';
    await this.create({
      organizationId: event.metadata.organizationId,
      type: accepted ? 'quote.accepted' : 'quote.rejected',
      title: accepted ? 'Presupuesto aceptado' : 'Presupuesto rechazado',
      message: `El presupuesto ${String(p.number)} fue ${accepted ? 'aceptado' : 'rechazado'} por el cliente`,
      link: `/quotes/${String(p.quoteId)}`,
      userId: event.metadata.userId,
    });
  }

  private async create(data: {
    organizationId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    userId?: string;
  }) {
    try {
      await this.prisma.notification.create({
        data: {
          organizationId: data.organizationId,
          type: data.type,
          title: data.title,
          message: data.message,
          link: data.link,
          userId: data.userId ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to create notification: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
