import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentWebhookController } from './agent-webhook.controller';
import { AgentActionsController } from './agent-actions.controller';
import { ScheduledAgentService } from './scheduled-agent.service';
import { AgentApiKeyGuard } from '../../common/guards/agent-api-key.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AgentsController, AgentWebhookController, AgentActionsController],
  providers: [AgentsService, ScheduledAgentService, AgentApiKeyGuard],
  exports: [AgentsService, AgentApiKeyGuard],
})
export class AgentsModule {}
