import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@nexa/database';
import type { DomainEvent } from '@nexa/domain';

@Injectable()
export class SearchIndexHandler {
  private readonly logger = new Logger(SearchIndexHandler.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('client.created')
  @OnEvent('client.updated')
  async handleClientIndex(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const title = String(payload.companyName ?? '');
    const content = `${title} ${String(payload.contactName ?? '')} ${String(payload.email ?? '')} ${String(payload.phone ?? '')}`;

    await this.upsertIndex(event, title, content);
  }

  @OnEvent('deal.created')
  @OnEvent('deal.updated')
  @OnEvent('deal.moved')
  async handleDealIndex(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const title = String(payload.title ?? '');
    const value = String(payload.value ?? '0');
    const stageName = String(payload.stageName ?? '');
    const content = `Oportunidad: ${title} - $${value} - Etapa: ${stageName}`;

    await this.upsertIndex(event, title, content);
  }

  @OnEvent('task.created')
  @OnEvent('task.updated')
  @OnEvent('task.completed')
  async handleTaskIndex(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const title = String(payload.title ?? '');
    const content = `Tarea: ${title} - Estado: ${String(payload.status ?? '')}`;

    await this.upsertIndex(event, title, content);
  }

  @OnEvent('quote.created')
  @OnEvent('quote.updated')
  @OnEvent('quote.sent')
  @OnEvent('quote.accepted')
  @OnEvent('quote.rejected')
  async handleQuoteIndex(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const number = String(payload.number ?? '');
    const status = String(payload.status ?? '');
    const title = `${number} - ${status}`;
    const content = `Presupuesto ${number} - Total: $${String(payload.total ?? '0')} - Estado: ${status}`;

    await this.upsertIndex(event, title, content);
  }

  @OnEvent('client.deleted')
  @OnEvent('deal.deleted')
  @OnEvent('task.deleted')
  @OnEvent('quote.deleted')
  async handleDeleteIndex(event: DomainEvent) {
    try {
      await this.prisma.searchIndex.deleteMany({
        where: {
          entityType: event.aggregateType,
          entityId: event.aggregateId,
          organizationId: event.metadata.organizationId,
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to delete search index for ${event.aggregateType}:${event.aggregateId}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }

  private async upsertIndex(event: DomainEvent, title: string, content: string) {
    try {
      const existing = await this.prisma.searchIndex.findFirst({
        where: {
          entityType: event.aggregateType,
          entityId: event.aggregateId,
          organizationId: event.metadata.organizationId,
        },
      });

      if (existing) {
        await this.prisma.searchIndex.update({
          where: { id: existing.id },
          data: { title, content, metadata: JSON.parse(JSON.stringify(event.payload)) },
        });
      } else {
        await this.prisma.searchIndex.create({
          data: {
            entityType: event.aggregateType,
            entityId: event.aggregateId,
            title,
            content,
            metadata: JSON.parse(JSON.stringify(event.payload)),
            organizationId: event.metadata.organizationId,
          },
        });
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to index ${event.aggregateType}:${event.aggregateId}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }
}
