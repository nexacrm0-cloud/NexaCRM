import { Injectable, Logger } from '@nestjs/common';
import {
  DEMO_ORG_SLUG,
  DemoFixtureResult,
  PrismaService,
  demoExpiryFromNow,
  resetDemoTenant,
} from '@nexa/database';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Demo tenants whose access window has already closed.
   *
   * The deadline itself is enforced on the request path (login / refresh /
   * JWT validation), so this list only drives the housekeeping reset.
   */
  async findExpiredDemoOrganizations(now: Date = new Date()) {
    return this.prisma.organization.findMany({
      where: {
        isDemo: true,
        demoExpiresAt: { not: null, lte: now },
      },
      select: { id: true, name: true, slug: true, demoExpiresAt: true },
    });
  }

  /**
   * Resets a demo tenant back to the seed fixture and opens a new 7 day
   * window. Returns null when another replica already holds the reset lock.
   */
  async resetDemoTenant(
    options: { slug?: string; demoExpiresAt?: Date } = {},
  ): Promise<DemoFixtureResult | null> {
    const demoExpiresAt = options.demoExpiresAt ?? demoExpiryFromNow();
    const result = await resetDemoTenant(this.prisma, {
      slug: options.slug ?? DEMO_ORG_SLUG,
      isDemo: true,
      demoExpiresAt,
    });

    if (result) {
      this.logger.log(
        `Demo "${result.slug}" reseteado. Nueva ventana hasta ${result.demoExpiresAt?.toISOString()}`,
      );
    }

    return result;
  }

  async getDemoStatus(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true, isDemo: true, demoExpiresAt: true },
    });

    return {
      isDemo: org?.isDemo ?? false,
      demoExpiresAt: org?.demoExpiresAt ?? null,
      slug: org?.slug ?? null,
    };
  }
}
