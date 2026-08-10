import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { NotificationsService } from '../notifications/notifications.service';
import { randomBytes } from 'crypto';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export type TransferInput = {
  workflowId: string;
  targetEmail?: string;
  // SECURITY ALTA-5: targetOrganizationId is intentionally NOT exposed to
  // callers — accepting it from the body allowed any ADMIN to clone a
  // workflow into an arbitrary organization. The destination is always
  // resolved internally from targetEmail (existing user's org or a freshly
  // provisioned one for that email).
  targetOrganizationId?: never;
};

export type TransferResult = {
  workflowId: string;
  targetOrganizationId: string;
  invitationId: string | null;
  invitationEmailSent: boolean;
  organizationCreated: boolean;
};

@Injectable()
export class WorkflowTransferService {
  private readonly logger = new Logger(WorkflowTransferService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  private async ensureUniqueOrgSlug(base: string): Promise<string> {
    let candidate = base || 'workspace';
    let i = 1;
    while (await this.prisma.organization.findUnique({ where: { slug: candidate } })) {
      i += 1;
      candidate = `${base}-${i}`;
      if (i > 50) {
        candidate = `${base}-${randomBytes(3).toString('hex')}`;
        break;
      }
    }
    return candidate;
  }

  /**
   * Transfers a workflow from one org to another.
   * If `targetEmail` is provided and no org matches it, a new organization
   * is created with that user as OWNER and a pending invitation email sent.
   */
  async transferToClient(sourceOrgId: string, input: TransferInput): Promise<TransferResult> {
    // SECURITY ALTA-5: rely solely on targetEmail to resolve the destination.
    // Reject any request that tries to bypass the email-based provisioning
    // by directly supplying a target organization id.
    if (!input.targetEmail) {
      throw new BadRequestException('targetEmail es requerido para transferir un workflow');
    }
    if ((input as any).targetOrganizationId) {
      // Explicit defense-in-depth: even if a future schema accidentally
      // reopens this field, we refuse to use it.
      throw new BadRequestException('No se permite especificar targetOrganizationId');
    }

    const source = await this.prisma.workflow.findUnique({
      where: { id: input.workflowId },
    });
    if (!source || source.organizationId !== sourceOrgId) {
      throw new BadRequestException('Workflow no encontrado en tu organización');
    }

    let targetOrgId: string | null = null;
    let invitationId: string | null = null;
    let invitationEmailSent = false;
    let organizationCreated = false;

    {
      const email = input.targetEmail.trim().toLowerCase();
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        targetOrgId = existingUser.organizationId;
      } else {
        const sourceOwner = await this.prisma.user.findFirst({
          where: { organizationId: sourceOrgId },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, firstName: true, lastName: true, role: true },
        });
        if (!sourceOwner) {
          throw new BadRequestException('No hay usuario origen con el cual invitar');
        }

        const orgName = email.split('@')[0] ?? 'Cliente';
        const slugBase = this.slugify(`${orgName}-${randomBytes(2).toString('hex')}`);
        const slug = await this.ensureUniqueOrgSlug(slugBase);

        const token = randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

        const org = await this.prisma.organization.create({
          data: {
            name: orgName.charAt(0).toUpperCase() + orgName.slice(1),
            slug,
            plan: 'pro',
          },
        });

        const inv = await this.prisma.invitation.create({
          data: {
            email,
            role: 'OWNER',
            token,
            status: 'PENDING',
            expiresAt,
            organizationId: org.id,
            invitedById: sourceOwner.id,
          },
        });

        invitationId = inv.id;
        targetOrgId = org.id;
        organizationCreated = true;

        try {
          const result = await this.notifications.sendAutomationProvisioningEmail({
            to: email,
            token,
            organizationName: org.name,
            invitedByName:
              `${sourceOwner.firstName} ${sourceOwner.lastName}`.trim() || 'un administrador',
            workflowName: source.name,
            workflowTrigger: source.trigger,
          });
          invitationEmailSent = !!result?.success;
        } catch (error) {
          this.logger.warn(
            `Failed to send invitation mail for transfer of ${source.id}: ${error instanceof Error ? error.message : 'unknown'}`,
          );
        }

        this.logger.log(
          `Provisioned new org ${org.id} + invitation ${inv.id} for ${email} via transfer of workflow ${source.id}`,
        );
      }
    }

    if (!targetOrgId) {
      throw new BadRequestException('No se pudo resolver el destino');
    }

    if (targetOrgId === sourceOrgId) {
      throw new BadRequestException('Ya pertenece a esta organización');
    }

    const existing = await this.prisma.workflow.findFirst({
      where: {
        organizationId: targetOrgId,
        trigger: source.trigger,
        name: source.name,
      },
    });
    if (existing) {
      return {
        workflowId: existing.id,
        targetOrganizationId: targetOrgId,
        invitationId,
        invitationEmailSent,
        organizationCreated,
      };
    }

    const cloned = await this.prisma.workflow.create({
      data: {
        organizationId: targetOrgId,
        createdById: source.createdById,
        name: source.name,
        description: source.description,
        trigger: source.trigger,
        triggerConfig: source.triggerConfig as any,
        actions: source.actions as any,
        conditions: (source.conditions as any) ?? undefined,
        isActive: true,
        sourceTemplateSlug: source.sourceTemplateSlug ?? null,
      },
    });

    if (source.sourceTemplateSlug) {
      const template = await this.prisma.workflowTemplate.findUnique({
        where: { slug: source.sourceTemplateSlug },
      });
      const monthlyPriceCents = template?.priceCents ?? 0;
      await this.prisma.automationSubscription.upsert({
        where: {
          organizationId_templateSlug: {
            organizationId: targetOrgId,
            templateSlug: source.sourceTemplateSlug,
          },
        },
        update: {
          workflowId: cloned.id,
          cancelledAt: null,
          monthlyPriceCents,
        },
        create: {
          organizationId: targetOrgId,
          providerOrganizationId: sourceOrgId,
          templateSlug: source.sourceTemplateSlug,
          workflowId: cloned.id,
          monthlyPriceCents,
          status: 'trialing',
          kind: 'trial',
          trialDays: 14,
          startedAt: new Date(),
        },
      });
    }

    return {
      workflowId: cloned.id,
      targetOrganizationId: targetOrgId,
      invitationId,
      invitationEmailSent,
      organizationCreated,
    };
  }

  async recentTransfers(sourceOrgId: string) {
    const inviterIds = await this.prisma.user.findMany({
      where: { organizationId: sourceOrgId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { id: true },
    });
    if (inviterIds.length === 0) return { data: [] };

    const orgs = await this.prisma.organization.findMany({
      where: { id: { not: sourceOrgId } },
      include: {
        invitations: {
          where: { invitedById: { in: inviterIds.map((u) => u.id) } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const rows = await Promise.all(
      orgs
        .filter((o) => o.invitations.length > 0)
        .map(async (o) => {
          const inv = o.invitations[0];
          const [workflow] = await this.prisma.workflow.findMany({
            where: { organizationId: o.id },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });
          return {
            invitationId: inv.id,
            email: inv.email,
            organizationId: o.id,
            organizationName: o.name,
            organizationPlan: o.plan,
            createdAt: inv.createdAt,
            status: inv.status,
            workflowId: workflow?.id ?? null,
            workflowName: workflow?.name ?? null,
            workflowTrigger: workflow?.trigger ?? null,
          };
        }),
    );

    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { data: rows };
  }

  async subscriptionsForVendor(providerOrgId: string) {
    const subs = await this.prisma.automationSubscription.findMany({
      where: { providerOrganizationId: providerOrgId },
      orderBy: { createdAt: 'desc' },
    });
    const now = Date.now();
    const TRIAL_DANGER_DAYS = 3;

    const augmented = subs.map((s) => {
      const trialEndsAt =
        s.kind === 'trial' && s.status === 'trialing'
          ? new Date(s.startedAt.getTime() + s.trialDays * 24 * 60 * 60 * 1000)
          : null;
      const daysToTrialEnd = trialEndsAt
        ? Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000))
        : null;
      const daysCancelledAgo =
        s.status === 'cancelled' && s.cancelledAt
          ? Math.floor((now - s.cancelledAt.getTime()) / (24 * 60 * 60 * 1000))
          : null;
      return { ...s, trialEndsAt, daysToTrialEnd, daysCancelledAgo };
    });

    if (augmented.length === 0) {
      return {
        data: [],
        summary: {
          active: 0,
          paused: 0,
          cancelled: 0,
          trialing: 0,
          mrrCents: 0,
          lowTrialAlerts: 0,
        },
      };
    }

    const orgIds = [...new Set(augmented.map((s) => s.organizationId))];
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, plan: true, slug: true },
    });
    const orgMap = new Map(orgs.map((o) => [o.id, o]));

    const rows = augmented.map((s) => ({
      id: s.id,
      templateSlug: s.templateSlug,
      status: s.status,
      kind: s.kind,
      monthlyPriceCents: s.monthlyPriceCents,
      startedAt: s.startedAt,
      cancelledAt: s.cancelledAt,
      trialEndsAt: s.trialEndsAt,
      daysToTrialEnd: s.daysToTrialEnd,
      isLowTrial:
        s.status === 'trialing' &&
        s.daysToTrialEnd !== null &&
        s.daysToTrialEnd <= TRIAL_DANGER_DAYS,
      customer: orgMap.get(s.organizationId)
        ? {
            organizationId: s.organizationId,
            organizationName: orgMap.get(s.organizationId)?.name ?? null,
            organizationSlug: orgMap.get(s.organizationId)?.slug ?? null,
            organizationPlan: orgMap.get(s.organizationId)?.plan ?? null,
          }
        : null,
    }));

    const summary = {
      active: rows.filter((r) => r.status === 'active').length,
      paused: rows.filter((r) => r.status === 'paused').length,
      cancelled: rows.filter((r) => r.status === 'cancelled').length,
      trialing: rows.filter((r) => r.status === 'trialing').length,
      mrrCents: rows
        .filter((r) => r.status === 'active')
        .reduce((acc, r) => acc + r.monthlyPriceCents, 0),
      lowTrialAlerts: rows.filter((r) => r.isLowTrial).length,
    };

    return { data: rows, summary };
  }
}
