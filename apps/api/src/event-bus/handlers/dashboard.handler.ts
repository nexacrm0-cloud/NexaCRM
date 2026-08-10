import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@nexa/database';
import type { DomainEvent } from '@nexa/domain';

type CounterField = 'newClients' | 'openOpportunities' | 'pendingTasks';

@Injectable()
export class DashboardHandler {
  private readonly logger = new Logger(DashboardHandler.name);

  constructor(private prisma: PrismaService) {}

  @OnEvent('client.created')
  async handleNewClient(event: DomainEvent) {
    await this.incrementMetric(event.metadata.organizationId, 'newClients');
  }

  @OnEvent('deal.created')
  async handleNewDeal(event: DomainEvent) {
    await this.incrementMetric(event.metadata.organizationId, 'openOpportunities');
  }

  @OnEvent('deal.moved')
  async handleDealMoved(event: DomainEvent) {
    const payload = event.payload as Record<string, unknown>;
    const stageName = String(payload.stageName ?? '');

    if (stageName.toLowerCase() === 'won' || stageName.toLowerCase() === 'ganada') {
      const value = Number(payload.value ?? 0);
      const current = await this.prisma.dashboardProjection.findUnique({
        where: { organizationId: event.metadata.organizationId },
      });
      const wonDeals = current?.wonDeals
        ? [...(JSON.parse(JSON.stringify(current.wonDeals)) as unknown[]), payload]
        : [payload];

      await this.prisma.dashboardProjection.upsert({
        where: { organizationId: event.metadata.organizationId },
        create: {
          organizationId: event.metadata.organizationId,
          monthlySales: value,
          newClients: 0,
          openOpportunities: 0,
          pendingTasks: 0,
          wonDeals: JSON.parse(JSON.stringify(wonDeals)),
        },
        update: {
          monthlySales: { increment: value },
          openOpportunities: { decrement: 1 },
          wonDeals: JSON.parse(JSON.stringify(wonDeals)),
        },
      });
      return;
    }

    if (stageName.toLowerCase() === 'lost' || stageName.toLowerCase() === 'perdida') {
      await this.incrementMetric(event.metadata.organizationId, 'openOpportunities', -1);
    }
  }

  @OnEvent('task.created')
  async handleNewTask(event: DomainEvent) {
    await this.incrementMetric(event.metadata.organizationId, 'pendingTasks');
  }

  @OnEvent('task.completed')
  async handleTaskCompleted(event: DomainEvent) {
    await this.incrementMetric(event.metadata.organizationId, 'pendingTasks', -1);
  }

  private async incrementMetric(organizationId: string, field: CounterField, delta = 1) {
    try {
      await this.prisma.dashboardProjection.upsert({
        where: { organizationId },
        create: {
          organizationId,
          monthlySales: 0,
          newClients: field === 'newClients' ? Math.max(0, delta) : 0,
          openOpportunities: field === 'openOpportunities' ? Math.max(0, delta) : 0,
          pendingTasks: field === 'pendingTasks' ? Math.max(0, delta) : 0,
          wonDeals: [],
        },
        update: {
          [field]: { increment: delta },
        },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to update dashboard projection for org ${organizationId}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }
}
