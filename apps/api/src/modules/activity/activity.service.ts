import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    params: { clientId?: string; dealId?: string; page: number; limit: number },
  ) {
    const { clientId, dealId, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (clientId) where.clientId = clientId;
    if (dealId) where.dealId = dealId;

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
