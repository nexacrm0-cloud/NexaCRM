import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import crypto from 'crypto';

@Injectable()
export class PipelineService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async getFunnel(organizationId: string) {
    const stages = await this.prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { position: 'asc' },
      include: {
        _count: { select: { deals: true } },
        deals: { select: { value: true } },
      },
    });

    return stages.map((stage) => ({
      stage: stage.name,
      deals: stage._count.deals,
      value: stage.deals.reduce((sum, d) => sum + Number(d.value), 0),
      color: stage.color,
    }));
  }

  async getForecast(organizationId: string) {
    const openDeals = await this.prisma.deal.findMany({
      where: {
        organizationId,
        stage: { isWinStage: false, isLoseStage: false },
      },
      select: {
        id: true,
        title: true,
        value: true,
        probability: true,
        currency: true,
        closeDate: true,
        stage: { select: { name: true } },
      },
    });

    const now = new Date();
    const totalWeighted = openDeals.reduce(
      (sum, d) => sum + Number(d.value) * (Number(d.probability) / 100),
      0,
    );
    const totalValue = openDeals.reduce((sum, d) => sum + Number(d.value), 0);

    const byMonth = new Map<string, number>();
    for (const d of openDeals) {
      if (!d.closeDate) continue;
      const key = new Date(d.closeDate).toISOString().slice(0, 7); // YYYY-MM
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(d.value) * (Number(d.probability) / 100));
    }
    const monthly = Array.from(byMonth.entries())
      .map(([month, weighted]) => ({ month, weighted: Math.round(weighted * 100) / 100 }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const staleThreshold = new Date(now);
    staleThreshold.setDate(staleThreshold.getDate() - 14);
    const staleCount = openDeals.filter(
      (d) => d.closeDate && new Date(d.closeDate) < staleThreshold,
    ).length;

    const wonAfter = await this.prisma.deal.count({
      where: {
        organizationId,
        stage: { isWinStage: true },
        updatedAt: { gte: new Date(new Date().setMonth(now.getMonth() - 1)) },
      },
    });

    return {
      openDealsCount: openDeals.length,
      openValue: Math.round(totalValue * 100) / 100,
      weightedForecast: Math.round(totalWeighted * 100) / 100,
      staleDealsCount: staleCount,
      wonLast30d: wonAfter,
      monthly,
    };
  }

  async getStages(organizationId: string) {
    return this.prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { position: 'asc' },
    });
  }

  async getHealth(organizationId: string) {
    const [stages, deals, stageMetrics, velocityData] = await Promise.all([
      this.prisma.pipelineStage.findMany({
        where: { organizationId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          isWinStage: true,
          isLoseStage: true,
          color: true,
          position: true,
        },
      }),
      this.prisma.deal.findMany({
        where: { organizationId },
        select: {
          id: true,
          value: true,
          stageId: true,
          updatedAt: true,
          createdAt: true,
          stage: { select: { name: true, isWinStage: true, isLoseStage: true } },
        },
      }),
      this.prisma.$queryRaw`
        SELECT 
          ps.id as "stageId",
          ps.name as "stageName",
          COUNT(d.id) as "dealCount",
          AVG(EXTRACT(EPOCH FROM (d."updatedAt" - d."createdAt")) / 86400000) as "avgDaysInStage",
          SUM(CASE WHEN d."stageId" = ps.id AND d."updatedAt" < NOW() - INTERVAL '20 days' THEN 1 ELSE 0 END) as "staleCount"
        FROM "public"."PipelineStage" ps
        LEFT JOIN "public"."Deal" d ON d."stageId" = ps.id AND d."organizationId" = ${organizationId}::uuid
        WHERE ps."organizationId" = ${organizationId}::uuid
        GROUP BY ps.id, ps.name
        ORDER BY ps.position ASC
      `,
      this.prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('week', "createdAt") as week,
          COUNT(*) as deals_created,
          COUNT(*) FILTER (WHERE "stageId" IN (SELECT id FROM "PipelineStage" WHERE "isWinStage" = true)) as won,
          COUNT(*) FILTER (WHERE "stageId" IN (SELECT id FROM "PipelineStage" WHERE "isLoseStage" = true)) as lost
        FROM "public"."Deal"
        WHERE "organizationId" = ${organizationId}::uuid
          AND "createdAt" >= NOW() - INTERVAL '12 weeks'
        GROUP BY DATE_TRUNC('week', "createdAt")
        ORDER BY week ASC
      `,
    ]);

    return { stages, deals, stageMetrics, velocityData };
  }

  async getDeals(
    organizationId: string,
    filters?: {
      stageId?: string;
      search?: string;
      assignedTo?: string;
      clientId?: string;
      minValue?: number;
      maxValue?: number;
      closeDateFrom?: string;
      closeDateTo?: string;
    },
  ) {
    const where: any = { organizationId };
    if (filters?.stageId) where.stageId = filters.stageId;
    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.minValue !== undefined || filters?.maxValue !== undefined) {
      where.value = {};
      if (filters?.minValue !== undefined) where.value.gte = filters.minValue;
      if (filters?.maxValue !== undefined) where.value.lte = filters.maxValue;
    }
    if (filters?.closeDateFrom || filters?.closeDateTo) {
      where.closeDate = {};
      if (filters?.closeDateFrom) where.closeDate.gte = new Date(filters.closeDateFrom);
      if (filters?.closeDateTo) where.closeDate.lte = new Date(filters.closeDateTo);
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { client: { companyName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.deal.findMany({
      where,
      include: {
        stage: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, companyName: true, contactName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getDeal(id: string, organizationId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: {
        stage: true,
        client: true,
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        tasks: {
          include: { assignee: { select: { firstName: true, lastName: true } } },
          orderBy: { updatedAt: 'desc' },
        },
        quotes: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
        activityLogs: {
          include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!deal) throw new NotFoundException('Oportunidad no encontrada');
    return deal;
  }

  async createDeal(organizationId: string, data: any, userId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: data.stageId, organizationId },
    });
    if (!stage) throw new BadRequestException('Etapa no encontrada');

    const deal = await this.prisma.deal.create({
      data: {
        title: data.title,
        value: data.value || 0,
        currency: data.currency || 'USD',
        probability: data.probability || 0,
        notes: data.notes || null,
        closeDate: data.closeDate ? new Date(data.closeDate) : null,
        stageId: data.stageId,
        clientId: data.clientId || null,
        assignedTo: data.assignedTo || null,
        organizationId,
      },
      include: {
        stage: { select: { name: true, color: true } },
        client: { select: { companyName: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
    });

    this.eventBus.emit({
      eventName: 'deal.created',
      aggregateType: 'deal',
      aggregateId: deal.id,
      payload: {
        dealId: deal.id,
        title: deal.title,
        value: Number(deal.value),
        stageId: deal.stageId,
        stageName: (deal as any).stage?.name ?? stage.name,
        clientId: deal.clientId,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return deal;
  }

  async updateDeal(id: string, organizationId: string, data: any, userId: string) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.probability !== undefined) updateData.probability = data.probability;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.closeDate !== undefined)
      updateData.closeDate = data.closeDate ? new Date(data.closeDate) : null;
    if (data.stageId !== undefined) updateData.stageId = data.stageId;
    if (data.clientId !== undefined) updateData.clientId = data.clientId || null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo || null;

    const [deal] = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.deal.findFirst({
        where: { id, organizationId },
      });
      if (!existing) throw new NotFoundException('Oportunidad no encontrada');

      const updated = await tx.deal.update({
        where: { id },
        data: updateData,
        include: {
          stage: { select: { name: true, color: true } },
          client: { select: { companyName: true } },
        },
      });

      return [updated];
    });

    this.eventBus.emit({
      eventName: 'deal.updated',
      aggregateType: 'deal',
      aggregateId: deal.id,
      payload: {
        dealId: deal.id,
        title: deal.title,
        value: Number(deal.value),
        stageId: deal.stageId,
        stageName: (deal as any).stage?.name ?? '',
        clientId: deal.clientId,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return deal;
  }

  async moveDeal(id: string, organizationId: string, stageId: string, userId: string) {
    return this.moveDeals(organizationId, [id], stageId, userId).then((r) => r[0]);
  }

  async moveDeals(
    organizationId: string,
    ids: string[],
    stageId: string,
    userId: string,
  ): Promise<Array<{ id: string; stageId: string; stageName: string }>> {
    if (ids.length === 0) return [];
    const [stage, toMove] = await this.prisma.$transaction(async (tx) => {
      const stageFn = await tx.pipelineStage.findFirst({
        where: { id: stageId, organizationId },
      });
      if (!stageFn) throw new BadRequestException('Etapa no encontrada');
      const entities = await tx.deal.findMany({
        where: { id: { in: ids }, organizationId },
        select: { id: true, stageId: true, title: true },
      });
      return [stageFn, entities];
    });
    if (toMove.length === 0) return [];

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.deal.updateMany({
        where: { id: { in: toMove.map((d) => d.id) }, organizationId },
        data: { stageId },
      });
      return tx.deal.findMany({
        where: { id: { in: toMove.map((d) => d.id) }, organizationId },
        select: {
          id: true,
          title: true,
          stageId: true,
          value: true,
          currency: true,
          stage: { select: { name: true } },
        },
      });
    });

    const moved = result.map((d) => ({ id: d.id, stageId: d.stageId, stageName: d.stage.name }));

    this.eventBus.emit({
      eventName: 'deals.moved',
      aggregateType: 'deal',
      aggregateId: stage.id,
      payload: {
        dealIds: moved.map((m) => m.id),
        previousStatuses: toMove.map((d) => ({
          id: d.id,
          previousStageId: d.stageId,
          title: d.title,
        })),
        newStageId: stageId,
        newStageName: stage.name,
      },
      metadata: {
        organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return moved;
  }

  async removeDeal(id: string, organizationId: string, userId: string) {
    const [existing] = await this.prisma.$transaction(async (tx) => {
      const found = await tx.deal.findFirst({
        where: { id, organizationId },
      });
      if (!found) throw new NotFoundException('Oportunidad no encontrada');

      await tx.deal.delete({ where: { id } });
      return [found];
    });

    this.eventBus.emit({
      eventName: 'deal.deleted',
      aggregateType: 'deal',
      aggregateId: id,
      payload: {
        dealId: id,
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
