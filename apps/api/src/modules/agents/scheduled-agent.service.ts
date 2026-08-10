import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentsService } from './agents.service';

@Injectable()
export class ScheduledAgentService {
  private readonly logger = new Logger(ScheduledAgentService.name);

  constructor(private agentsService: AgentsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleExecutions() {
    try {
      await this.agentsService.cleanupStaleExecutions(30);
    } catch (err) {
      this.logger.error(`Cleanup error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyAgents() {
    this.logger.log('Running daily scheduled agents...');

    const dailyTypes = ['business_analyst', 'operations', 'sales'];

    try {
      const subscriptions = await this.agentsService.getAllActiveSubscriptions();

      for (const sub of subscriptions) {
        if (!dailyTypes.includes(sub.agent.type)) continue;

        try {
          const result = await this.agentsService.dispatchToAgent({
            agentId: sub.agent.id,
            organizationId: sub.organization.id,
            event: 'scheduled.daily',
            payload: { triggeredAt: new Date().toISOString() },
            webhookUrl: sub.agent.webhookUrl,
          });

          if (result.status === 'FAILED') {
            this.logger.warn(
              `Scheduled dispatch failed for ${sub.agent.type} (${sub.organization.name})`,
            );
          } else {
            this.logger.log(
              `Scheduled daily agent: ${sub.agent.type} for ${sub.organization.name}`,
            );
          }
        } catch (err) {
          this.logger.error(
            `Error running ${sub.agent.type} for ${sub.organization.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error running daily agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
