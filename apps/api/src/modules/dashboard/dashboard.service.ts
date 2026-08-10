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

    return {
      monthlySales: Number(projection?.monthlySales || 0),
      newClients: projection?.newClients || 0,
      openOpportunities: projection?.openOpportunities || 0,
      pendingTasks: projection?.pendingTasks || 0,
      wonDeals: Array.isArray(projection?.wonDeals) ? projection.wonDeals : [],
      recentActivity,
    };
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
