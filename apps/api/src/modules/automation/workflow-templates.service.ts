import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, Prisma } from '@nexa/database';
import { z } from 'zod';
import { validateWebhookUrl } from '../../common/utils/ssrf-validator';

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export type TemplateParamField = {
  key: string;
  label: string;
  type: 'text' | 'url' | 'longtext' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
};

export type InstallTemplateInput = {
  slug: string;
  params: Record<string, unknown>;
};

@Injectable()
export class WorkflowTemplatesService {
  constructor(private prisma: PrismaService) {}

  private async requirePlan(organizationId: string, required: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });
    const level = PLAN_HIERARCHY[org?.plan ?? 'free'] ?? 0;
    if (level < (PLAN_HIERARCHY[required] ?? 0)) {
      throw new ForbiddenException(`Requiere plan ${required} o superior`);
    }
  }

  async list(category?: string, search?: string) {
    const where: Record<string, unknown> = { isPublished: true, isPrivate: false };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    const templates = await this.prisma.workflowTemplate.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { installCount: 'desc' }, { name: 'asc' }],
    });
    return { data: templates };
  }

  /**
   * Vista pública del catálogo (no auth). Devuelve sólo los campos necesarios
   * para armar el landing público /automation/pro. Omite paramSchema/defaultConfig
   * (que son sensibles para la instalación) y cualquier metadata interna.
   */
  async publicCatalog() {
    const templates = await this.prisma.workflowTemplate.findMany({
      where: { isPublished: true, isPrivate: false },
      orderBy: [{ isFeatured: 'desc' }, { installCount: 'desc' }, { name: 'asc' }],
      select: {
        slug: true,
        name: true,
        shortDescription: true,
        longDescription: true,
        category: true,
        icon: true,
        trigger: true,
        plan: true,
        priceCents: true,
        isFeatured: true,
        installCount: true,
      },
    });

    const totalInstalls = templates.reduce((acc, t) => acc + t.installCount, 0);
    const categories = Array.from(new Set(templates.map((t) => t.category))).sort();

    return {
      data: templates,
      summary: {
        totalTemplates: templates.length,
        totalInstalls,
        categories,
      },
    };
  }

  async getBySlug(slug: string) {
    const template = await this.prisma.workflowTemplate.findUnique({ where: { slug } });
    if (!template || !template.isPublished) {
      throw new NotFoundException('Template no encontrado');
    }
    return template;
  }

  async install(organizationId: string, userId: string, input: InstallTemplateInput) {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { slug: input.slug },
    });
    if (!template || !template.isPublished) {
      throw new NotFoundException('Template no encontrado');
    }
    await this.requirePlan(organizationId, template.plan);

    const paramSchema =
      (template.paramSchema as unknown as { fields?: TemplateParamField[] })?.fields ?? [];
    const defaults = (template.defaultConfig as Record<string, unknown>) ?? {};
    const merged: Record<string, unknown> = { ...defaults, ...input.params };

    for (const field of paramSchema) {
      const value = merged[field.key];
      if (field.required && (value === undefined || value === null || value === '')) {
        throw new BadRequestException(`Falta el parámetro "${field.label}"`);
      }
      if (field.type === 'url' && typeof value === 'string' && value.length > 0) {
        validateWebhookUrl(value);
      }
    }

    // El proveedor es la organización que originó el template. Si el template
    // no fue publicado por una organización (es decir, es uno default sembrado),
    // el provider es el propio cliente: la suscripción queda "auto-provisionada"
    // y el cliente decide si quiere mantenerla como paid.
    const providerOrganizationId = organizationId;

    // Usamos el formulario interactivo de $transaction para obtener el id del
    // workflow creado y usarlo en el upsert de la suscripción (necesitamos el
    // workflowId sincronizado desde el día 0).
    const workflow = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workflow.create({
        data: {
          organizationId,
          createdById: userId,
          name: template.name,
          description: template.shortDescription,
          trigger: template.trigger,
          triggerConfig: merged as any,
          actions: [],
          conditions: Prisma.JsonNull,
          isActive: true,
          sourceTemplateSlug: template.slug,
        },
      });

      await tx.workflowTemplate.update({
        where: { id: template.id },
        data: { installCount: { increment: 1 } },
      });

      await tx.automationSubscription.upsert({
        where: {
          organizationId_templateSlug: { organizationId, templateSlug: template.slug },
        },
        update: {
          workflowId: created.id,
          cancelledAt: null,
          status: 'trialing',
          kind: 'trial',
          monthlyPriceCents: template.priceCents,
          startedAt: new Date(),
        },
        create: {
          organizationId,
          providerOrganizationId,
          templateSlug: template.slug,
          workflowId: created.id,
          monthlyPriceCents: template.priceCents,
          status: 'trialing',
          kind: 'trial',
          trialDays: 14,
          startedAt: new Date(),
        },
      });

      return created;
    });

    return workflow;
  }

  async toggleFeatured(slug: string) {
    const template = await this.prisma.workflowTemplate.findUnique({ where: { slug } });
    if (!template) {
      throw new NotFoundException('Template no encontrado');
    }
    return this.prisma.workflowTemplate.update({
      where: { id: template.id },
      data: { isFeatured: !template.isFeatured },
    });
  }

  async setFeatured(slug: string, featured: boolean) {
    const template = await this.prisma.workflowTemplate.findUnique({ where: { slug } });
    if (!template) {
      throw new NotFoundException('Template no encontrado');
    }
    return this.prisma.workflowTemplate.update({
      where: { id: template.id },
      data: { isFeatured: featured },
    });
  }

  async adminList() {
    return {
      data: await this.prisma.workflowTemplate.findMany({
        orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
      }),
    };
  }

  async setPrivate(slug: string, isPrivate: boolean) {
    const template = await this.prisma.workflowTemplate.findUnique({ where: { slug } });
    if (!template) {
      throw new NotFoundException('Template no encontrado');
    }
    return this.prisma.workflowTemplate.update({
      where: { id: template.id },
      data: { isPrivate },
    });
  }
}
