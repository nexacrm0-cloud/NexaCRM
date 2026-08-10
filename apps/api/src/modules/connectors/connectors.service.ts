import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { ConnectorType } from '@nexa/shared';

export interface ConnectorConfig {
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  // Flexible config for different providers
  settings: Record<string, any>;
}

@Injectable()
export class ConnectorsService {
  constructor(private prisma: PrismaService) {}

  async getConnectors(organizationId: string) {
    return this.prisma.plugin.findMany({
      where: { organizationId },
    });
  }

  async upsertConnector(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      type: ConnectorType;
      config: ConnectorConfig;
    },
  ) {
    // Check if connector of this type already exists
    const existing = await this.prisma.plugin.findFirst({
      where: { organizationId, name: data.type },
    });

    if (existing) {
      return this.prisma.plugin.update({
        where: { id: existing.id },
        data: {
          config: JSON.parse(JSON.stringify(data.config)),
          // Update last used or updated at if needed
        },
      });
    }

    return this.prisma.plugin.create({
      data: {
        name: data.type,
        displayName: data.type.toUpperCase(),
        version: '1.0.0',
        source: 'nexa',
        config: JSON.parse(JSON.stringify(data.config)),
        organizationId,
        installedById: userId,
        isActive: true,
      },
    });
  }

  async deleteConnector(id: string, organizationId: string) {
    return this.prisma.plugin.delete({
      where: { id, organizationId },
    });
  }

  async getConnectorConfig(type: ConnectorType, organizationId: string) {
    const plugin = await this.prisma.plugin.findFirst({
      where: { name: type, organizationId },
    });
    return plugin?.config as ConnectorConfig | null;
  }
}
