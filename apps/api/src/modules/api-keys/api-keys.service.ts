import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, name: string, userId: string, expiresInDays?: number) {
    const rawKey = `nx_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = rawKey.substring(0, 12) + '...';
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name,
        key: hashedKey,
        prefix,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
        organizationId,
        createdById: userId,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      rawKey,
      createdAt: apiKey.createdAt,
    };
  }

  async remove(id: string, organizationId: string) {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('API Key no encontrada');
    await this.prisma.apiKey.delete({ where: { id } });
  }

  async validate(key: string): Promise<{ organizationId: string } | null> {
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({ where: { key: hashedKey } });
    if (!apiKey || !apiKey.isActive) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return { organizationId: apiKey.organizationId };
  }
}
