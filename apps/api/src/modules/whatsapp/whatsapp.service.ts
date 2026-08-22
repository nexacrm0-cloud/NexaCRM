import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import { AgentsService } from '../agents/agents.service';
import { sanitizeString } from '../../common/utils/sanitize';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  // SECURITY: cap the size of any user-supplied string we propagate. WhatsApp
  // text messages are theoretically unbounded but Meta caps at ~65k chars in
  // practice. Truncating to 16k chars here is a defense-in-depth cap that
  // (a) prevents memory pressure if a misbehaving sender sends a multi-MB
  // payload through the schema and (b) keeps downstream event-bus payloads
  // bounded. The `sanitizeString` helper also strips control chars that
  // could break terminal/JSON rendering.
  private static readonly MAX_WHATSAPP_BODY = 16_000;

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

    // SECURITY: normalize the inbound body before propagating it to the
    // event bus / agent webhook. We strip control characters (including the
    // bidi-override set U+202A-U+202E / U+2066-U+2069 used in some phishing
    // payloads to spoof filenames in chat UIs) and cap length so a runaway
    // sender can't bloat the payload.
    const sanitizedBody = sanitizeString(
      payload.messageBody ?? '',
      WhatsAppService.MAX_WHATSAPP_BODY,
    );

    const domainPayload = {
      phoneNumberId: payload.phoneNumberId,
      from: payload.from,
      messageBody: sanitizedBody,
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
