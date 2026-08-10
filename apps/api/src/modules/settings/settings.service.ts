import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { updateSettingsSchema } from '@nexa/shared';
import type { z } from 'zod';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        plan: true,
        currency: true,
        locale: true,
      },
    });

    if (!org) throw new NotFoundException('Organización no encontrada');

    return {
      organization: org,
      defaults: {
        taxRate: 21,
        timezone: 'America/Argentina/Buenos_Aires',
        dateFormat: 'DD/MM/YYYY',
      },
    };
  }

  async updateSettings(organizationId: string, raw: unknown) {
    const data = updateSettingsSchema.parse(raw);
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.logo !== undefined) updateData.logo = data.logo || null;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.locale !== undefined) updateData.locale = data.locale;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
      });
    }

    return { success: true };
  }
}
