import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { PlanTier } from '@nexa/shared';
import { validateWebhookUrlAsync } from '../../common/utils/ssrf-validator';
import { randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getAgentById(agentId: string) {
    return this.prisma.agent.findUnique({ where: { id: agentId } });
  }

  async getAvailableAgents(organizationId: string) {
    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true },
      });

      const orgPlanLevel = PLAN_HIERARCHY[org?.plan ?? 'free'] ?? 0;

      const allAgents = await this.prisma.agent.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      const subscriptions = await this.prisma.agentSubscription.findMany({
        where: { organizationId },
      });

      const subscribedAgentIds = new Set(
        subscriptions.filter((s) => s.isActive).map((s) => s.agentId),
      );
      const apiKeyByAgent = new Map(subscriptions.map((s) => [s.agentId, s.apiKey]));

      return allAgents.map((agent) => {
        const featuresArray = Array.isArray(agent.features) ? agent.features : [];
        const isSubscribed = subscribedAgentIds.has(agent.id);
        return {
          id: agent.id,
          name: agent.name,
          displayName: agent.displayName,
          description: agent.description,
          type: agent.type,
          icon: agent.icon,
          webhookUrl: agent.webhookUrl,
          workflowUrl: agent.workflowUrl,
          requiredPlan: agent.requiredPlan,
          features: featuresArray,
          isActive: agent.isActive,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
          isSubscribed,
          isUnlocked: orgPlanLevel >= (PLAN_HIERARCHY[agent.requiredPlan] ?? 0),
          apiKey: isSubscribed ? apiKeyByAgent.get(agent.id) : undefined,
        };
      });
    } catch (error) {
      this.logger.error(
        'Error getting available agents',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async activateAgent(organizationId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agente no encontrado');

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });

    const orgPlanLevel = PLAN_HIERARCHY[org?.plan ?? 'free'] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[agent.requiredPlan] ?? 0;

    if (orgPlanLevel < requiredLevel) {
      throw new ForbiddenException(`Este agente requiere el plan ${agent.requiredPlan} o superior`);
    }

    const existing = await this.prisma.agentSubscription.findUnique({
      where: { organizationId_agentId: { organizationId, agentId } },
    });

    if (existing) {
      if (existing.isActive) {
        return {
          apiKey: existing.apiKey,
          isActive: true,
          agentId: existing.agentId,
          organizationId: existing.organizationId,
        };
      }
      const updated = await this.prisma.agentSubscription.update({
        where: { id: existing.id },
        data: { isActive: true, activatedAt: new Date(), deactivatedAt: null },
      });
      return {
        apiKey: updated.apiKey,
        isActive: updated.isActive,
        agentId: updated.agentId,
        organizationId: updated.organizationId,
      };
    }

    const apiKey = 'ag_' + randomBytes(24).toString('hex');
    const subscription = await this.prisma.agentSubscription.create({
      data: { organizationId, agentId, isActive: true, apiKey },
    });

    return subscription;
  }

  async deactivateAgent(organizationId: string, agentId: string) {
    const existing = await this.prisma.agentSubscription.findUnique({
      where: { organizationId_agentId: { organizationId, agentId } },
    });

    if (!existing || !existing.isActive) {
      throw new NotFoundException('Suscripción al agente no encontrada');
    }

    return this.prisma.agentSubscription.update({
      where: { id: existing.id },
      data: { isActive: false, deactivatedAt: new Date() },
    });
  }

  async getAgentApiKey(organizationId: string, agentId: string) {
    const sub = await this.prisma.agentSubscription.findUnique({
      where: { organizationId_agentId: { organizationId, agentId } },
      select: { apiKey: true, isActive: true },
    });

    if (!sub) {
      throw new NotFoundException('Suscripción al agente no encontrada. Activalo primero.');
    }

    return {
      apiKey: sub.apiKey,
      isActive: sub.isActive,
      agentId,
    };
  }

  async regenerateAgentApiKey(organizationId: string, agentId: string, actorId: string) {
    const existing = await this.prisma.agentSubscription.findUnique({
      where: { organizationId_agentId: { organizationId, agentId } },
    });

    if (!existing) {
      throw new NotFoundException('Suscripción al agente no encontrada. Activalo primero.');
    }

    const oldKey = existing.apiKey;
    const newKey = 'ag_' + randomBytes(24).toString('hex');

    const updated = await this.prisma.agentSubscription.update({
      where: { id: existing.id },
      data: { apiKey: newKey },
      select: { apiKey: true, isActive: true, agentId: true },
    });

    // Audit log: queda registro permanente de quien regenero la key + timestamp.
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId: actorId,
        eventType: 'agent.api_key.regenerate',
        action: 'regenerate',
        entityType: 'agent_subscription',
        entityId: existing.id,
        metadata: {
          agentId,
          oldKeyPrefix: oldKey.slice(0, 8),
          newKeyPrefix: newKey.slice(0, 8),
        },
      },
    });

    this.logger.warn(
      `API key regenerated for agent ${agentId} in org ${organizationId} by user ${actorId}. Old key prefix ${oldKey.slice(0, 8)} revoked.`,
    );

    return updated;
  }

  async getAgentMetrics(organizationId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agente no encontrado');

    const logs = await this.prisma.agentExecution.findMany({
      where: { organizationId, agentId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const totalExecutions = logs.length;
    const successfulExecutions = logs.filter((l) => l.status === 'COMPLETED').length;
    const failedExecutions = logs.filter((l) => l.status === 'FAILED').length;
    const lastExecution = logs[0] ?? null;

    return {
      agentId,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      lastExecutionAt: lastExecution?.completedAt,
    };
  }

  // Called by n8n or internal systems to log agent execution
  async logExecution(data: {
    agentId: string;
    organizationId: string;
    status: string;
    input: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    durationMs?: number;
  }) {
    return this.prisma.agentExecution.create({
      data: {
        agentId: data.agentId,
        organizationId: data.organizationId,
        status: data.status,
        input: data.input,
        output: data.output ?? undefined,
        error: data.error ?? undefined,
        durationMs: data.durationMs ?? undefined,
        completedAt:
          data.status === 'COMPLETED' || data.status === 'FAILED' ? new Date() : undefined,
      },
    });
  }

  // Called by n8n to report execution result
  async reportExecution(
    executionId: string,
    expectedOrganizationId: string,
    expectedAgentId: string,
    data: {
      status: 'COMPLETED' | 'FAILED';
      output?: Record<string, any>;
      error?: string;
      durationMs?: number;
    },
  ) {
    const existing = await this.prisma.agentExecution.findUnique({ where: { id: executionId } });
    if (!existing) throw new NotFoundException('Execution not found');

    // SECURITY CR2/A9: reject callbacks whose declared tenant/agent do not
    // match the execution's original tenant/agent. A leaked INTERNAL_API_KEY
    // alone is then insufficient to mutate another org's executions.
    if (
      existing.organizationId !== expectedOrganizationId ||
      existing.agentId !== expectedAgentId
    ) {
      throw new ForbiddenException('Execution does not belong to the declared organization/agent');
    }
    // Only RUNNING executions can be updated; completed ones are immutable.
    if (existing.status !== 'RUNNING') {
      throw new BadRequestException('Execution already completed');
    }

    const updated = await this.prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: data.status,
        output: data.output ?? undefined,
        error: data.error ?? undefined,
        durationMs: data.durationMs ?? undefined,
        completedAt: new Date(),
      },
    });

    try {
      const org = await this.prisma.organization.findUnique({
        where: { id: updated.organizationId },
        include: {
          users: {
            where: { role: { in: ['OWNER', 'ADMIN'] } },
            orderBy: { createdAt: 'asc' },
            take: 3,
          },
        },
      });
      const agent = await this.prisma.agent.findUnique({ where: { id: updated.agentId } });
      if (!org || !agent) return updated;

      const summary = data.output?.summary ?? data.output?.message ?? undefined;
      for (const recipient of org.users) {
        await this.notifications
          .sendAgentExecutionEmail({
            to: recipient.email,
            firstName: recipient.firstName,
            agentType: agent.type,
            agentName: agent.name,
            eventName: (updated.input as any)?.event ?? 'desconocido',
            status: data.status,
            durationMs: data.durationMs,
            summary,
            error: data.error,
            dashboardsUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/agents`,
          })
          .catch((err) =>
            this.logger.warn(
              `Failed sending agent summary to ${recipient.email}: ${err instanceof Error ? err.message : 'unknown'}`,
            ),
          );
      }
    } catch (err) {
      this.logger.warn(
        `Agent summary side-effect failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    return updated;
  }

  async getExecutionLogs(organizationId: string, agentId: string, limit = 20) {
    return this.prisma.agentExecution.findMany({
      where: { organizationId, agentId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  // Get all active agent subscriptions for an org (used by event handler)
  async getActiveSubscriptions(organizationId: string) {
    return this.prisma.agentSubscription.findMany({
      where: { organizationId, isActive: true },
      include: { agent: true },
    });
  }

  // SECURITY CR3: returns the active subscription for a specific (org, agent)
  // pair. Used by the trigger webhook to validate that the caller may
  // dispatch the agent on that tenant.
  async getActiveSubscription(organizationId: string, agentId: string) {
    return this.prisma.agentSubscription.findFirst({
      where: { organizationId, agentId, isActive: true },
    });
  }

  async getAllActiveSubscriptions() {
    return this.prisma.agentSubscription.findMany({
      where: { isActive: true },
      include: {
        agent: { select: { id: true, type: true, webhookUrl: true } },
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async cleanupStaleExecutions(maxAgeMinutes = 30) {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const stale = await this.prisma.agentExecution.findMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: cutoff },
      },
    });

    for (const exec of stale) {
      await this.prisma.agentExecution.update({
        where: { id: exec.id },
        data: {
          status: 'FAILED',
          error: `Timeout - no callback received within ${maxAgeMinutes} minutes`,
          completedAt: new Date(),
        },
      });
    }

    if (stale.length > 0) {
      this.logger.warn(
        `Marked ${stale.length} stale execution(s) as FAILED (timeout > ${maxAgeMinutes}m)`,
      );
    }
  }

  async dispatchToAgent(params: {
    agentId: string;
    organizationId: string;
    event: string;
    payload: Record<string, any>;
    webhookUrl: string;
  }): Promise<{ executionId: string; status: string }> {
    const execution = await this.prisma.agentExecution.create({
      data: {
        agentId: params.agentId,
        organizationId: params.organizationId,
        status: 'RUNNING',
        input: JSON.parse(JSON.stringify({ event: params.event, payload: params.payload })),
      },
    });

    try {
      await validateWebhookUrlAsync(params.webhookUrl);
      const response = await fetch(params.webhookUrl, {
        method: 'POST',
        redirect: 'manual', // SECURITY: never follow 30x to SSRF targets
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          executionId: execution.id,
          agentId: params.agentId,
          organizationId: params.organizationId,
          event: params.event,
          payload: params.payload,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.logger.log(`Dispatched agent ${params.agentId} for event ${params.event}`);
      return { executionId: execution.id, status: 'RUNNING' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Dispatch to n8n failed for agent ${params.agentId}: ${errorMsg}`);

      await this.prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: `Dispatch failed: ${errorMsg}`,
          completedAt: new Date(),
        },
      });

      return { executionId: execution.id, status: 'FAILED' };
    }
  }
}
