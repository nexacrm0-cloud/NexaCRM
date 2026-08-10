import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { Workflow, WorkflowExecutionLog } from '@nexa/shared';

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

@Injectable()
export class WorkflowService {
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

  async findAll(organizationId: string) {
    await this.requirePlan(organizationId, 'starter');
    return this.prisma.workflow.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
    });
    if (!workflow || workflow.organizationId !== organizationId) {
      throw new NotFoundException('Workflow no encontrado');
    }
    return workflow;
  }

  async create(organizationId: string, userId: string, data: any) {
    await this.requirePlan(organizationId, 'starter');
    const d = data as any;
    return this.prisma.workflow.create({
      data: {
        name: d.name,
        trigger: d.trigger,
        organizationId,
        createdById: userId,
        triggerConfig: d.triggerConfig ?? {},
        actions: d.actions ?? [],
        conditions: d.conditions ?? null,
      },
    });
  }

  async update(id: string, organizationId: string, data: any) {
    await this.requirePlan(organizationId, 'starter');
    const workflow = await this.findOne(id, organizationId);
    const d = data as any;
    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.trigger !== undefined && { trigger: d.trigger }),
        ...(d.triggerConfig !== undefined && { triggerConfig: d.triggerConfig }),
        ...(d.actions !== undefined && { actions: d.actions }),
        ...(d.conditions !== undefined && { conditions: d.conditions }),
      },
    });
  }

  async delete(id: string, organizationId: string) {
    await this.requirePlan(organizationId, 'starter');
    const workflow = await this.findOne(id, organizationId);
    return this.prisma.workflow.delete({ where: { id } });
  }

  async toggleActive(id: string, organizationId: string) {
    await this.requirePlan(organizationId, 'starter');
    const workflow = await this.findOne(id, organizationId);
    return this.prisma.workflow.update({
      where: { id },
      data: { isActive: !workflow.isActive },
    });
  }

  async getExecutionLogs(organizationId: string, limit = 50, page = 1) {
    await this.requirePlan(organizationId, 'starter');
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.workflowExecutionLog.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: skip,
        include: { workflow: true },
      }),
      this.prisma.workflowExecutionLog.count({ where: { organizationId } }),
    ]);

    return {
      data,
      meta: { total, page, totalPages: Math.ceil(total / limit) },
    };
  }
}
