import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private agentsService: AgentsService,
  ) {}

  async handleIncomingMessage(payload: {
    phoneNumberId: string;
    from: string;
    messageBody: string;
    messageId: string;
    timestamp: string;
  }) {
    // Idempotency: skip if we've already processed this messageId
    // (Meta occasionally redelivers webhook events)
    if (payload.messageId) {
      const existing = await this.prisma.whatsappProcessedMessage.findUnique({
        where: { messageId: payload.messageId },
      });
      if (existing) {
        this.logger.log(
          `WhatsApp message ${payload.messageId} already processed at ${existing.processedAt.toISOString()} — skipping duplicate`,
        );
        return { status: 'duplicate', processedAt: existing.processedAt.toISOString() };
      }
    }

    const plugin = await this.prisma.plugin.findFirst({
      where: {
        name: 'whatsapp',
        isActive: true,
      },
    });

    if (!plugin) {
      this.logger.warn(`WhatsApp message from ${payload.from} but no org has WhatsApp configured`);
      return { status: 'ignored', reason: 'no_active_connector' };
    }

    const orgId = plugin.organizationId;

    const subscription = await this.prisma.agentSubscription.findFirst({
      where: {
        organizationId: orgId,
        isActive: true,
        agent: { type: 'whatsapp_ai', isActive: true },
      },
      include: { agent: true },
    });

    if (!subscription) {
      this.logger.log(`Org ${orgId} received WhatsApp message but whatsapp_ai agent is not active`);
      return { status: 'ignored', reason: 'agent_not_active' };
    }

    const domainPayload = {
      phoneNumberId: payload.phoneNumberId,
      from: payload.from,
      messageBody: payload.messageBody,
      messageId: payload.messageId,
      receivedAt: payload.timestamp,
      organizationId: orgId,
    };

    this.eventBus.emit({
      eventName: 'whatsapp.message_received',
      aggregateType: 'whatsapp',
      aggregateId: payload.messageId,
      payload: domainPayload,
      metadata: {
        organizationId: orgId,
        userId: 'system',
        correlationId: payload.messageId,
        timestamp: new Date(payload.timestamp),
      },
    });

    const result = await this.agentsService.dispatchToAgent({
      agentId: subscription.agent.id,
      organizationId: orgId,
      event: 'whatsapp.message_received',
      payload: domainPayload,
      webhookUrl: subscription.agent.webhookUrl,
    });

    // Record the messageId to prevent duplicate processing from Meta redeliveries
    if (payload.messageId) {
      try {
        await this.prisma.whatsappProcessedMessage.create({
          data: {
            messageId: payload.messageId,
            organizationId: orgId,
            from: payload.from,
          },
        });
      } catch (err) {
        // Race condition handling: another instance may have inserted concurrently,
        // that's fine — the duplicate check would catch the next delivery.
        this.logger.warn(`Failed to record messageId ${payload.messageId}: ${err}`);
      }
    }

    this.logger.log(
      `Dispatched WhatsApp message ${payload.messageId} to agent ${subscription.agent.id}`,
    );

    return { status: 'dispatched', executionId: result.executionId };
  }

  async handleStatusCallback(payload: { messageId: string; status: string; recipientId: string }) {
    this.logger.log(`WhatsApp status update: ${payload.messageId} -> ${payload.status}`);
    return { status: 'received' };
  }
}
