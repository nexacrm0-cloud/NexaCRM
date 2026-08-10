import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { CompanySize, SupportStatus } from '@nexa/shared';

export interface OrganizationSupportInfo {
  id: string;
  name: string;
  slug: string;
  companySize: CompanySize;
  supportStatus: SupportStatus;
  plan: string;
  lastRunAt: string | null;
  workflowCount: number;
}

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async getAllOrganizations() {
    return this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        companySize: true,
        supportStatus: true,
        plan: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getOrganizationDetails(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) throw new NotFoundException('Organización no encontrada');

    const workflowCount = await this.prisma.workflow.count({
      where: { organizationId },
    });

    const lastWorkflow = await this.prisma.workflowExecutionLog.findFirst({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
    });

    return {
      ...org,
      workflowCount,
      lastRunAt: lastWorkflow?.completedAt,
    };
  }

  async updateSupportStatus(organizationId: string, status: SupportStatus) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { supportStatus: status },
    });
  }

  async updateCompanySize(organizationId: string, size: CompanySize) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { companySize: size },
    });
  }
}
