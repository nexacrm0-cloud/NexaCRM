import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import type { PaymentProvider, PaymentWebhookEvent } from '../billing/payment-provider.interface';
import { NotificationsService } from '../notifications/notifications.service';

const PLAN_HIERARCHY = { free: 0, starter: 1, pro: 2, enterprise: 3 };
const REQUIRED_PLAN_FOR_BILLING = 'starter';
const PLAN_NAMES: Record<string, string> = {
  free: 'Básico',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    @Inject('PAYMENT_PROVIDER') private payments: PaymentProvider,
  ) {}

  private async requireStarterOrAbove(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });
    const level = PLAN_HIERARCHY[(org?.plan ?? 'free') as keyof typeof PLAN_HIERARCHY] ?? 0;
    if (level < PLAN_HIERARCHY[REQUIRED_PLAN_FOR_BILLING]) {
      throw new ForbiddenException(`Requiere plan ${REQUIRED_PLAN_FOR_BILLING} o superior`);
    }
  }

  async listForCustomer(organizationId: string) {
    const subs = await this.prisma.automationSubscription.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { name: true, category: true, shortDescription: true, trigger: true, icon: true },
        },
      },
    });

    // Levantamos los workflows provisionados en paralelo para mostrar en el
    // portal qué automatización está corriendo (estado, último run, trigger).
    const workflowIds = subs.map((s) => s.workflowId).filter(Boolean);
    const workflows =
      workflowIds.length > 0
        ? await this.prisma.workflow.findMany({
            where: { id: { in: workflowIds } },
            select: {
              id: true,
              isActive: true,
              trigger: true,
              lastRunAt: true,
              description: true,
            },
          })
        : [];
    const workflowById = new Map(workflows.map((w) => [w.id, w]));

    // Última ejecución conocida del workflow (para el "corrió hace X" badge).
    const lastLogs =
      workflowIds.length > 0
        ? await this.prisma.workflowExecutionLog.findMany({
            where: { workflowId: { in: workflowIds } },
            orderBy: { startedAt: 'desc' },
            distinct: ['workflowId'],
            take: workflowIds.length,
            select: { workflowId: true, status: true, startedAt: true },
          })
        : [];
    const lastLogByWorkflow = new Map(lastLogs.map((l) => [l.workflowId, l]));

    const augmented = subs.map((s) => {
      const workflow = workflowById.get(s.workflowId) ?? null;
      const lastLog = workflow ? (lastLogByWorkflow.get(workflow.id) ?? null) : null;
      const trialEndsAt =
        s.kind === 'trial' && s.status === 'trialing'
          ? new Date(s.startedAt.getTime() + s.trialDays * 24 * 60 * 60 * 1000)
          : null;
      const daysToTrialEnd = trialEndsAt
        ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
      const daysToRenewal = s.billingCycleEndsAt
        ? Math.ceil((s.billingCycleEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null;
      return {
        id: s.id,
        templateSlug: s.templateSlug,
        templateName: s.template?.name ?? s.templateSlug,
        templateCategory: s.template?.category ?? null,
        templateDescription: s.template?.shortDescription ?? null,
        templateIcon: s.template?.icon ?? null,
        status: s.status,
        kind: s.kind,
        monthlyPriceCents: s.monthlyPriceCents,
        startedAt: s.startedAt,
        billingCycleEndsAt: s.billingCycleEndsAt,
        cancelledAt: s.cancelledAt,
        trialEndsAt,
        daysToTrialEnd,
        daysToRenewal,
        workflow: workflow
          ? {
              id: workflow.id,
              isActive: workflow.isActive,
              trigger: workflow.trigger,
              lastRunAt: lastLog?.startedAt ?? workflow.lastRunAt ?? null,
              lastRunStatus: lastLog?.status ?? null,
            }
          : null,
      };
    });

    return { data: augmented };
  }

  async startPaidCheckout(
    organizationId: string,
    userId: string,
    templateSlug: string,
    frontendUrl: string,
  ) {
    await this.requireStarterOrAbove(organizationId);
    const sub = await this.prisma.automationSubscription.findUnique({
      where: { organizationId_templateSlug: { organizationId, templateSlug } },
      include: { template: true, organization: true },
    });
    if (!sub) {
      throw new NotFoundException('No tenés esta automatización instalada todavía');
    }
    if (sub.status === 'cancelled') {
      throw new BadRequestException('La suscripción fue cancelada');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, organizationId: true },
    });
    if (!owner || owner.organizationId !== organizationId) {
      throw new ForbiddenException('No autorizado');
    }

    const template = sub.template;
    const right = template ? Math.max(template.priceCents, 0) : 0;

    const checkout = await this.payments.createSubscription({
      customerEmail: owner.email,
      customerName: `${owner.firstName} ${owner.lastName}`.trim() || owner.email,
      description: template?.name ?? sub.templateSlug,
      amountCents: right,
      currency: 'ARS',
      interval: 'month',
      externalReference: sub.id,
      successUrl: `${frontendUrl}/automation/subscriptions`,
      failureUrl: `${frontendUrl}/automation/subscriptions`,
    });

    await this.prisma.automationSubscription.update({
      where: { id: sub.id },
      data: {
        kind: 'paid',
        monthlyPriceCents: right,
        billingExternalId: checkout.externalId,
        status: sub.status === 'trialing' ? sub.status : 'active',
      },
    });

    return {
      data: {
        approvalUrl: checkout.approvalUrl,
        externalId: checkout.externalId,
        amountCents: right,
      },
    };
  }

  async cancel(organizationId: string, templateSlug: string) {
    const sub = await this.prisma.automationSubscription.findUnique({
      where: { organizationId_templateSlug: { organizationId, templateSlug } },
    });
    if (!sub) throw new NotFoundException('Suscripción no encontrada');

    if (sub.billingExternalId) {
      await this.payments.cancelSubscription(sub.billingExternalId).catch(() => undefined);
    }

    const updated = await this.prisma.automationSubscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
    return { data: { id: updated.id, status: updated.status, cancelledAt: updated.cancelledAt } };
  }

  /**
   * Switch from trial to paid once activated. Transitions after webhook events.
   */
  async applyEvent(subId: string, event: PaymentWebhookEvent) {
    if (event.kind === 'subscription.activated') {
      const activatedAt = event.activatedAt;
      const cycle = new Date(activatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      await this.prisma.automationSubscription.update({
        where: { id: subId },
        data: {
          status: 'active',
          kind: 'paid',
          billingCycleEndsAt: cycle,
          billingExternalId: event.externalId,
        },
      });

      try {
        const sub = await this.prisma.automationSubscription.findUnique({
          where: { id: subId },
          include: {
            organization: {
              include: {
                users: {
                  where: { role: { in: ['OWNER', 'ADMIN'] } },
                  orderBy: { createdAt: 'asc' },
                  take: 3,
                },
              },
            },
            template: true,
          },
        });
        if (sub) {
          for (const u of sub.organization.users) {
            await this.notifications
              .sendSubscriptionActivatedEmail({
                to: u.email,
                firstName: u.firstName,
                templateName: sub.template?.name ?? sub.templateSlug,
                amountCents: sub.monthlyPriceCents,
                cycleEndsAt: cycle,
              })
              .catch(() => undefined);
          }
        }
      } catch (err) {
        this.logger.warn(
          `Side-effect for sub activation failed: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    } else if (event.kind === 'subscription.cancelled') {
      await this.prisma.automationSubscription.update({
        where: { id: subId },
        data: { status: 'cancelled', cancelledAt: event.cancelledAt },
      });
    } else if (event.kind === 'subscription.payment_failed') {
      await this.prisma.automationSubscription.update({
        where: { id: subId },
        data: { status: 'paused' },
      });
      try {
        const sub = await this.prisma.automationSubscription.findUnique({
          where: { id: subId },
          include: {
            organization: {
              include: {
                users: {
                  where: { role: { in: ['OWNER', 'ADMIN'] } },
                  orderBy: { createdAt: 'asc' },
                  take: 3,
                },
              },
            },
            template: true,
          },
        });
        if (sub) {
          for (const u of sub.organization.users) {
            await this.notifications
              .sendSubscriptionFailedEmail({
                to: u.email,
                firstName: u.firstName,
                templateName: sub.template?.name ?? sub.templateSlug,
                reason: 'Pago rechazado',
              })
              .catch(() => undefined);
          }
        }
      } catch (err) {
        this.logger.warn(
          `Side-effect for sub failure failed: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
  }

  /**
   * Manual activation flow: useful for "manual admin override" or when the stub provider is in use.
   */
  async markPaid(subId: string, organizationId: string) {
    const sub = await this.prisma.automationSubscription.findUnique({
      where: { id: subId },
      include: {
        organization: {
          include: {
            users: {
              where: { role: { in: ['OWNER', 'ADMIN'] } },
              orderBy: { createdAt: 'asc' },
              take: 3,
            },
          },
        },
        template: true,
      },
    });
    if (!sub || sub.organizationId !== organizationId) {
      throw new NotFoundException('Subscription no encontrada');
    }
    const cycle = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.automationSubscription.update({
      where: { id: sub.id, organizationId },
      data: {
        status: 'active',
        kind: 'paid',
        billingCycleEndsAt: cycle,
        monthlyPriceCents: sub.template?.priceCents ?? sub.monthlyPriceCents,
        billingExternalId: sub.billingExternalId ?? `manual_${Date.now()}`,
      },
    });
    for (const u of sub.organization.users) {
      await this.notifications
        .sendSubscriptionActivatedEmail({
          to: u.email,
          firstName: u.firstName,
          templateName: sub.template?.name ?? sub.templateSlug,
          amountCents: updated.monthlyPriceCents,
          cycleEndsAt: cycle,
        })
        .catch(() => undefined);
    }
    return { data: { id: updated.id, status: updated.status, billingCycleEndsAt: cycle } };
  }

  async handleWebhook(
    payload: unknown,
    headers: Record<string, string>,
    query?: Record<string, unknown>,
  ) {
    const events = await this.payments.parseWebhook(payload, headers, query);
    let applied = 0;
    for (const ev of events) {
      const ref = 'externalReference' in ev ? ev.externalReference : undefined;
      if (!ref) continue;

      if (ref.startsWith('plan:')) {
        const parts = ref.split(':');
        if (parts.length !== 3) {
          this.logger.warn(`Invalid plan reference ${ref}`);
          continue;
        }
        const plan = parts[1];
        const orgId = parts[2];
        if (!PLAN_NAMES[plan]) {
          this.logger.warn(`Unknown plan in reference ${ref}`);
          continue;
        }
        await this.applyPlanEvent(plan, orgId, ev);
        applied += 1;
        continue;
      }

      const sub = await this.prisma.automationSubscription.findFirst({
        where: { id: ref },
      });
      if (!sub) {
        this.logger.warn(`Webhook event for unknown subscription ${ref}`);
        continue;
      }
      await this.applyEvent(sub.id, ev);
      applied += 1;
    }
    return { data: { applied } };
  }

  /**
   * Base-plan lifecycle: updates the org `subscription` row + `organization.plan`
   * after a Mercado Pago preapproval event. Runs as the nexa_app RLS role with an
   * empty org var (webhooks are unauthenticated), so we bind `app.organization_id`
   * transaction-locally — the same pattern used by the register flow — to make the
   * RLS policies on `subscriptions` / `users` match before reading/writing.
   */
  async applyPlanEvent(plan: string, organizationId: string, event: PaymentWebhookEvent) {
    let cycleEnd: Date | null = null;
    const owners = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, true)`,
        organizationId,
      );

      const owners = await tx.user.findMany({
        where: { organizationId, role: { in: ['OWNER', 'ADMIN'] } },
        select: { email: true, firstName: true },
        take: 3,
      });

      if (event.kind === 'subscription.activated') {
        const activatedAt = event.activatedAt;
        cycleEnd = new Date(activatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

        await tx.subscription.upsert({
          where: { organizationId },
          create: {
            organizationId,
            plan,
            status: 'active',
            currentPeriodStart: activatedAt,
            currentPeriodEnd: cycleEnd,
            paymentProviderId: event.externalId,
          },
          update: {
            plan,
            status: 'active',
            currentPeriodStart: activatedAt,
            currentPeriodEnd: cycleEnd,
            paymentProviderId: event.externalId,
            canceledAt: null,
          },
        });

        await tx.organization.update({
          where: { id: organizationId },
          data: { plan },
        });
      } else if (event.kind === 'subscription.cancelled') {
        const current = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { plan: true },
        });
        if (current?.plan === plan) {
          await tx.subscription.updateMany({
            where: { organizationId },
            data: { status: 'canceled', canceledAt: event.cancelledAt },
          });
          await tx.organization.update({
            where: { id: organizationId },
            data: { plan: 'free' },
          });
        } else {
          this.logger.warn(
            `Ignoring cancellation of plan=${plan} for org=${organizationId} (current=${current?.plan})`,
          );
        }
      } else if (event.kind === 'subscription.payment_failed') {
        await tx.subscription.updateMany({
          where: { organizationId },
          data: { status: 'paused' },
        });
      }

      return owners;
    });

    const planName = PLAN_NAMES[plan] ?? plan;
    try {
      if (event.kind === 'subscription.activated') {
        for (const u of owners) {
          await this.notifications
            .sendSubscriptionActivatedEmail({
              to: u.email,
              firstName: u.firstName,
              templateName: `Plan ${planName}`,
              amountCents: 0,
              cycleEndsAt: cycleEnd ?? new Date(),
            })
            .catch(() => undefined);
        }
      } else if (event.kind === 'subscription.payment_failed') {
        for (const u of owners) {
          await this.notifications
            .sendSubscriptionFailedEmail({
              to: u.email,
              firstName: u.firstName,
              templateName: `Plan ${planName}`,
              reason: event.reason ?? 'Pago rechazado',
            })
            .catch(() => undefined);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Side-effect for plan event failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
