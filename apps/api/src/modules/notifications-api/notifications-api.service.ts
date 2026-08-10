import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

@Injectable()
export class NotificationsApiService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, userId?: string, limit = 20) {
    const where: any = { organizationId };
    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);
    return { data, meta: { total, unreadCount } };
  }

  async markAsRead(id: string, organizationId: string) {
    return this.prisma.notification.updateMany({
      where: { id, organizationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(organizationId: string, userId?: string) {
    const where: any = { organizationId, isRead: false };
    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }
    return this.prisma.notification.updateMany({
      where,
      data: { isRead: true },
    });
  }

  async create(data: {
    organizationId: string;
    type: string;
    title: string;
    message?: string;
    link?: string;
    userId?: string;
  }) {
    return this.prisma.notification.create({ data });
  }
}
