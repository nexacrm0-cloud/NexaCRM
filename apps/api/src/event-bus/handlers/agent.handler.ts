import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@nexa/domain';
import { AgentsService } from '../../modules/agents/agents.service';

const EVENT_AGENT_MAP: Record<string, string[]> = {
  'client.created': ['sales', 'follow_up', 'whatsapp_ai'],
  'deal.created': ['sales', 'whatsapp_ai'],
  'deal.updated': ['sales', 'whatsapp_ai'],
  'deal.won': ['sales', 'business_analyst', 'whatsapp_ai'],
  'deal.lost': ['sales', 'whatsapp_ai'],
  'quote.sent': ['follow_up', 'whatsapp_ai'],
  'quote.accepted': ['operations', 'whatsapp_ai'],
  'invoice.issued': ['follow_up', 'whatsapp_ai'],
  'task.created': ['operations', 'whatsapp_ai'],
  'task.updated': ['operations', 'whatsapp_ai'],
  'whatsapp.message_received': ['whatsapp_ai'],
};

@Injectable()
export class AgentEventHandler {
  private readonly logger = new Logger(AgentEventHandler.name);

  constructor(private agentsService: AgentsService) {}

  @OnEvent('client.created')
  @OnEvent('deal.created')
  @OnEvent('deal.updated')
  @OnEvent('deal.won')
  @OnEvent('deal.lost')
  @OnEvent('quote.sent')
  @OnEvent('quote.accepted')
  @OnEvent('invoice.issued')
  @OnEvent('task.created')
  @OnEvent('task.updated')
  @OnEvent('whatsapp.message_received')
  async handleEvent(event: DomainEvent) {
    const agentTypes = EVENT_AGENT_MAP[event.eventName];
    if (!agentTypes) return;

    const orgId = event.metadata.organizationId;
    if (!orgId) return;

    let subscriptions;
    try {
      subscriptions = await this.agentsService.getActiveSubscriptions(orgId);
    } catch (err) {
      this.logger.error(
        `Failed to fetch subscriptions for org ${orgId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    for (const sub of subscriptions) {
      if (!agentTypes.includes(sub.agent.type)) continue;
      if (!sub.agent.webhookUrl) {
        this.logger.warn(`Agent ${sub.agent.type} has no webhookUrl configured`);
        continue;
      }

      try {
        const result = await this.agentsService.dispatchToAgent({
          agentId: sub.agent.id,
          organizationId: orgId,
          event: event.eventName,
          payload: event.payload,
          webhookUrl: sub.agent.webhookUrl,
        });

        if (result.status === 'FAILED') {
          this.logger.warn(`Dispatch failed for ${sub.agent.type} on event ${event.eventName}`);
        } else {
          this.logger.log(`Triggered ${sub.agent.type} agent for event ${event.eventName}`);
        }
      } catch (err) {
        this.logger.error(
          `Error processing ${sub.agent.type} for event ${event.eventName}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
