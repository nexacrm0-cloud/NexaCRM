import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

@Injectable()
export class InternalService {
  constructor(private prisma: PrismaService) {}

  private async validateOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
  }

  async getPipelineData(organizationId: string) {
    await this.validateOrganization(organizationId);
    const stages = await this.prisma.pipelineStage.findMany({
      where: { organizationId },
      orderBy: { position: 'asc' },
      include: {
        deals: {
          orderBy: { position: 'asc' },
          include: {
            assignee: { select: { firstName: true, lastName: true, email: true } },
            client: { select: { companyName: true, contactName: true } },
            activityLogs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { createdAt: true, type: true },
            },
          },
        },
      },
    });

    const now = new Date();
    const staleThreshold = 14 * 24 * 60 * 60 * 1000;

    const allDeals = stages.flatMap((s) => s.deals);
    const staleDeals = allDeals.filter((d) => {
      const lastActivity = d.activityLogs[0]?.createdAt ?? d.updatedAt;
      return now.getTime() - new Date(lastActivity).getTime() > staleThreshold;
    });

    const totalValue = allDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const wonDeals = allDeals.filter((d) => stages.find((s) => s.id === d.stageId)?.isWinStage);
    const lostDeals = allDeals.filter((d) => stages.find((s) => s.id === d.stageId)?.isLoseStage);

    return {
      stages: stages.map((s) => ({
        name: s.name,
        position: s.position,
        dealCount: s.deals.length,
        totalValue: s.deals.reduce((sum, d) => sum + Number(d.value), 0),
        deals: s.deals.map((d) => ({
          id: d.id,
          title: d.title,
          value: Number(d.value),
          currency: d.currency,
          probability: d.probability,
          closeDate: d.closeDate,
          client: d.client?.companyName,
          assignee: d.assignee ? `${d.assignee.firstName} ${d.assignee.lastName}` : null,
          lastActivity: d.activityLogs[0]?.createdAt ?? null,
          daysSinceActivity: Math.floor(
            (now.getTime() - new Date(d.activityLogs[0]?.createdAt ?? d.updatedAt).getTime()) /
              86400000,
          ),
        })),
      })),
      summary: {
        totalDeals: allDeals.length,
        totalValue,
        wonCount: wonDeals.length,
        lostCount: lostDeals.length,
        staleDealsCount: staleDeals.length,
        staleDeals: staleDeals.map((d) => ({
          id: d.id,
          title: d.title,
          value: Number(d.value),
          daysSinceActivity: Math.floor(
            (now.getTime() - new Date(d.activityLogs[0]?.createdAt ?? d.updatedAt).getTime()) /
              86400000,
          ),
          assignee: d.assignee ? `${d.assignee.firstName} ${d.assignee.lastName}` : null,
        })),
      },
    };
  }

  async getClientData(organizationId: string) {
    await this.validateOrganization(organizationId);
    const clients = await this.prisma.client.findMany({
      where: { organizationId },
      include: {
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: { type: true, description: true, createdAt: true },
        },
        deals: {
          select: { id: true, title: true, value: true, stageId: true },
        },
        quotes: {
          where: { status: { in: ['SENT', 'DRAFT'] } },
          select: { id: true, number: true, total: true, status: true, sentAt: true },
        },
        invoices: {
          where: { status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] } },
          select: { id: true, number: true, total: true, status: true, issuedAt: true },
        },
      },
    });

    const now = new Date();
    const staleDays = 14;
    const staleThreshold = staleDays * 24 * 60 * 60 * 1000;

    const staleClients = clients.filter((c) => {
      const lastActivity = c.activityLogs[0]?.createdAt ?? c.updatedAt;
      return now.getTime() - new Date(lastActivity).getTime() > staleThreshold;
    });

    const overdueInvoices = clients.flatMap((c) =>
      c.invoices
        .filter((i) => i.status === 'OVERDUE' || i.status === 'ISSUED')
        .map((i) => ({
          clientId: c.id,
          clientName: c.companyName,
          invoiceNumber: i.number,
          total: Number(i.total),
          status: i.status,
          issuedAt: i.issuedAt,
        })),
    );

    return {
      totalClients: clients.length,
      staleClientsCount: staleClients.length,
      staleClients: staleClients.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        daysSinceActivity: Math.floor(
          (now.getTime() - new Date(c.activityLogs[0]?.createdAt ?? c.updatedAt).getTime()) /
            86400000,
        ),
        lastActivityType: c.activityLogs[0]?.type ?? null,
        lastActivityDescription: c.activityLogs[0]?.description ?? null,
        openDeals: c.deals.length,
        pendingQuotes: c.quotes.length,
      })),
      clientsNeedingAttention: clients
        .filter((c) => c.quotes.length > 0 || c.invoices.some((i) => i.status === 'OVERDUE'))
        .map((c) => ({
          id: c.id,
          companyName: c.companyName,
          contactName: c.contactName,
          pendingQuotes: c.quotes.map((q) => ({
            number: q.number,
            total: Number(q.total),
            sentAt: q.sentAt,
          })),
          overdueInvoices: c.invoices
            .filter((i) => i.status === 'OVERDUE')
            .map((i) => ({ number: i.number, total: Number(i.total) })),
        })),
      overdueInvoices,
    };
  }

  async getMetricsData(organizationId: string) {
    await this.validateOrganization(organizationId);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    const [deals, tasks, clients, invoices, activityLogs] = await Promise.all([
      this.prisma.deal.findMany({
        where: { organizationId, createdAt: { gte: ninetyDaysAgo } },
        include: {
          stage: { select: { name: true, isWinStage: true, isLoseStage: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.task.findMany({
        where: { organizationId },
        select: {
          id: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.client.findMany({
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, createdAt: true },
      }),
      this.prisma.invoice.findMany({
        where: { organizationId },
        select: { id: true, total: true, status: true, issuedAt: true, paidAt: true },
      }),
      this.prisma.activityLog.findMany({
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, type: true, createdAt: true },
      }),
    ]);

    const wonDeals = deals.filter((d) => d.stage.isWinStage);
    const lostDeals = deals.filter((d) => d.stage.isLoseStage);
    const activeDeals = deals.filter((d) => !d.stage.isWinStage && !d.stage.isLoseStage);

    const totalRevenue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const totalPipeline = activeDeals.reduce((sum, d) => sum + Number(d.value), 0);

    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
    const overdueTasks = tasks.filter(
      (t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < now,
    );

    const paidInvoices = invoices.filter((i) => i.status === 'PAID');
    const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);
    const avgInvoice =
      invoices.length > 0
        ? invoices.reduce((sum, i) => sum + Number(i.total), 0) / invoices.length
        : 0;

    const conversionRate = deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0;

    const avgDealCycle =
      wonDeals.length > 1
        ? wonDeals.reduce((sum, d) => {
            const cycle = new Date(d.updatedAt).getTime() - new Date(d.createdAt).getTime();
            return sum + cycle;
          }, 0) /
          wonDeals.length /
          86400000
        : 0;

    return {
      revenue: {
        totalRevenue,
        totalPipeline,
        totalPaid,
        avgInvoice,
        forecast: (totalPipeline * conversionRate) / 100,
      },
      pipeline: {
        totalDeals: deals.length,
        activeDeals: activeDeals.length,
        wonDeals: wonDeals.length,
        lostDeals: lostDeals.length,
        conversionRate,
        avgDealCycleDays: Math.round(avgDealCycle),
      },
      tasks: {
        total: tasks.length,
        completed: completedTasks.length,
        overdue: overdueTasks.length,
        completionRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
      },
      clients: {
        newThisMonth: clients.length,
      },
      activity: {
        totalActions: activityLogs.length,
        avgActionsPerDay: Math.round(activityLogs.length / 30),
      },
      topPerformers: Object.entries(
        wonDeals.reduce(
          (acc, d) => {
            const name = d.assignee
              ? `${d.assignee.firstName} ${d.assignee.lastName}`
              : 'Sin asignar';
            acc[name] = (acc[name] || 0) + Number(d.value);
            return acc;
          },
          {} as Record<string, number>,
        ),
      )
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value]) => ({ name, value })),
    };
  }

  async getTasksData(organizationId: string) {
    await this.validateOrganization(organizationId);
    const now = new Date();

    const [tasks, users] = await Promise.all([
      this.prisma.task.findMany({
        where: { organizationId },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          client: { select: { companyName: true } },
          deal: { select: { title: true } },
        },
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    const overdue = tasks.filter(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'CANCELLED' &&
        t.dueDate &&
        new Date(t.dueDate) < now,
    );
    const dueToday = tasks.filter((t) => {
      if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      const due = new Date(t.dueDate);
      return due.toDateString() === now.toDateString();
    });
    const dueThisWeek = tasks.filter((t) => {
      if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
      const due = new Date(t.dueDate);
      const weekEnd = new Date(now.getTime() + 7 * 86400000);
      return due > now && due <= weekEnd;
    });

    const workload = users.map((u) => {
      const userTasks = tasks.filter(
        (t) => t.assignedTo === u.id && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      );
      const userOverdue = userTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
      return {
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        totalTasks: userTasks.length,
        overdueTasks: userOverdue.length,
        urgentTasks: userTasks.filter((t) => t.priority === 'URGENT').length,
        highTasks: userTasks.filter((t) => t.priority === 'HIGH').length,
      };
    });

    const byPriority = {
      URGENT: tasks.filter(
        (t) => t.priority === 'URGENT' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      ).length,
      HIGH: tasks.filter(
        (t) => t.priority === 'HIGH' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      ).length,
      MEDIUM: tasks.filter(
        (t) => t.priority === 'MEDIUM' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      ).length,
      LOW: tasks.filter(
        (t) => t.priority === 'LOW' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
      ).length,
    };

    return {
      summary: {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'PENDING').length,
        inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter((t) => t.status === 'COMPLETED').length,
        overdue: overdue.length,
        dueToday: dueToday.length,
        dueThisWeek: dueThisWeek.length,
      },
      overdueTasks: overdue.slice(0, 20).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate,
        assignee: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
        client: t.client?.companyName ?? null,
        deal: t.deal?.title ?? null,
        daysOverdue: Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86400000),
      })),
      byPriority,
      workload,
    };
  }
}
