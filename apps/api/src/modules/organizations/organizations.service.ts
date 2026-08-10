import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async getUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
