import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(organizationId: string) {
    const projection = await this.prisma.dashboardProjection.findUnique({
      where: { organizationId },
    });

    const recentActivity = await this.prisma.activityLog.findMany({
      where: { organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        client: { select: { companyName: true } },
        deal: { select: { title: true } },
        task: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // "Negocios ganados": se calcula desde los deals reales en la etapa
    // ganadora. La proyección (`dashboard_projections.wonDeals`) es sólo un
    // cache y puede venir con otro shape (p.ej. el fixture de demo), así que
    // se usa únicamente como fallback.
    const wonDeals = await this.prisma.deal.findMany({
      where: { organizationId, stage: { isWinStage: true } },
      select: {
        id: true,
        title: true,
        value: true,
        updatedAt: true,
        client: { select: { companyName: true } },
        stage: { select: { name: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return {
      monthlySales: Number(projection?.monthlySales || 0),
      newClients: projection?.newClients || 0,
      openOpportunities: projection?.openOpportunities || 0,
      pendingTasks: projection?.pendingTasks || 0,
      wonDeals: wonDeals.length
        ? wonDeals.map((deal) => ({
            id: deal.id,
            title: deal.title,
            value: Number(deal.value),
            date: deal.updatedAt,
            client: deal.client,
            stage: deal.stage,
            assignee: deal.assignee,
          }))
        : this.normalizeProjectedDeals(projection?.wonDeals),
      recentActivity,
    };
  }

  /**
   * Normalizes the cached projection to the SAME shape the UI expects
   * (`client.companyName`, `stage.name`, `assignee.firstName`). Without this,
   * a projection written with a flat `client: 'Acme'` would crash the
   * dashboard with "Cannot read properties of undefined (reading 'firstName')".
   */
  private normalizeProjectedDeals(raw: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(raw)) return [];

    return raw.map((deal: any, index: number) => ({
      id: deal?.id ?? `projected-deal-${index}`,
      title: deal?.title ?? 'Negocio ganado',
      value: Number(deal?.value ?? 0),
      date: deal?.date ?? null,
      client:
        deal?.client && typeof deal.client === 'object'
          ? deal.client
          : { companyName: String(deal?.client ?? '') },
      stage:
        deal?.stage && typeof deal.stage === 'object'
          ? deal.stage
          : { name: String(deal?.stage ?? 'Ganado') },
      assignee:
        deal?.assignee && typeof deal.assignee === 'object'
          ? deal.assignee
          : { firstName: '', lastName: '' },
    }));
  }

  async getSalesTrend(organizationId: string) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const wonDeals = await this.prisma.deal.findMany({
      where: {
        organizationId,
        stage: { isWinStage: true },
        updatedAt: { gte: sixMonthsAgo },
      },
      select: { value: true, updatedAt: true },
    });

    const months: Array<{ month: string; sales: number }> = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('es-ES', { month: 'short' });
      const sales = wonDeals
        .filter((deal) => {
          const dealMonth = `${deal.updatedAt.getFullYear()}-${String(deal.updatedAt.getMonth() + 1).padStart(2, '0')}`;
          return dealMonth === monthKey;
        })
        .reduce((sum, deal) => sum + Number(deal.value), 0);
      months.unshift({ month: monthName, sales });
    }
    return months;
  }

  async getRecentActivity(organizationId: string) {
    return this.prisma.activityLog.findMany({
      where: { organizationId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
