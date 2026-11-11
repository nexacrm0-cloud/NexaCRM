import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DemoService } from './demo.service';

/**
 * Housekeeping for time-boxed sales demo tenants.
 *
 * The deadline itself is enforced on the request path, so a prospect loses
 * access the exact millisecond the window closes — regardless of whether this
 * cron ran. The cron only takes care of the housekeeping: once the window is
 * over, the tenant is wiped back to the seed fixture and a fresh 7 day window
 * is opened for the next prospect.
 */
@Injectable()
export class DemoExpiryService {
  private readonly logger = new Logger(DemoExpiryService.name);

  constructor(private demoService: DemoService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireDemoTenants() {
    try {
      const expired = await this.demoService.findExpiredDemoOrganizations();

      for (const org of expired) {
        this.logger.log(
          `Demo "${org.slug}" venció (${org.demoExpiresAt?.toISOString()}). Reseteando...`,
        );

        const result = await this.demoService.resetDemoTenant({ slug: org.slug });

        if (!result) {
          this.logger.warn(`Demo "${org.slug}" ya está siendo reseteado por otro proceso.`);
        }
      }
    } catch (err) {
      this.logger.error(
        `Error expirando demos: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
