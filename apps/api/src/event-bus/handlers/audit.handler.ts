import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@nexa/database';
import type { DomainEvent } from '@nexa/domain';

@Injectable()
export class AuditHandler {
  private readonly logger = new Logger(AuditHandler.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('client.created')
  @OnEvent('client.updated')
  @OnEvent('client.deleted')
  @OnEvent('deal.created')
  @OnEvent('deal.updated')
  @OnEvent('deal.moved')
  @OnEvent('deal.deleted')
  @OnEvent('task.created')
  @OnEvent('task.updated')
  @OnEvent('task.completed')
  @OnEvent('task.deleted')
  @OnEvent('quote.created')
  @OnEvent('quote.updated')
  @OnEvent('quote.sent')
  @OnEvent('quote.accepted')
  @OnEvent('quote.rejected')
  @OnEvent('quote.deleted')
  @OnEvent('organization.created')
  @OnEvent('user.created')
  @OnEvent('user.updated')
  @OnEvent('invitation.created')
  @OnEvent('invitation.accepted')
  @OnEvent('invoice.issued')
  @OnEvent('invoice.paid')
  @OnEvent('invoice.cancelled')
  @OnEvent('event.created')
  @OnEvent('event.updated')
  @OnEvent('event.deleted')
  async handleAuditEvent(event: DomainEvent) {
    try {
      const action = event.eventName.split('.').pop() ?? 'unknown';

      await this.prisma.auditLog.create({
        data: {
          eventType: event.eventName,
          entityType: event.aggregateType,
          entityId: event.aggregateId,
          action,
          changes: JSON.parse(JSON.stringify(event.payload)),
          metadata: JSON.parse(JSON.stringify(event.metadata)),
          ipAddress: null,
          userAgent: null,
          organizationId: event.metadata.organizationId,
          userId: event.metadata.userId,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to write audit log for ${event.eventName}:${event.aggregateId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
