import { Injectable, Logger } from '@nestjs/common';
import type {
  PaymentProvider,
  PaymentSubscriptionInput,
  PaymentSubscriptionResult,
  PaymentWebhookEvent,
} from './payment-provider.interface';

/**
 * Stub implementation of PaymentProvider that simulates a real gateway.
 * Activation is automatic (the next "tick" the subscription becomes active), so the
 * UI can flip from `trialing` to `paid` without external dependencies.
 *
 * Replaceable with a Mercado Pago / Stripe impl without touching consumers.
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly kind = 'stub';
  private readonly logger = new Logger(StubPaymentProvider.name);

  async createSubscription(input: PaymentSubscriptionInput): Promise<PaymentSubscriptionResult> {
    const externalId = `stub_${input.externalReference}_${Date.now().toString(36)}`;
    const approvalUrl = `${input.successUrl}?stub_id=${encodeURIComponent(externalId)}`;
    this.logger.warn(
      `[STUB] createSubscription externalId=${externalId} amount=${input.amountCents} ${input.currency} ref=${input.externalReference}`,
    );
    return {
      externalId,
      approvalUrl,
      status: 'pending',
    };
  }

  async cancelSubscription(externalId: string): Promise<void> {
    this.logger.warn(`[STUB] cancelSubscription ${externalId}`);
  }

  async parseWebhook(payload: unknown): Promise<PaymentWebhookEvent[]> {
    if (!payload || typeof payload !== 'object') return [];
    const p = payload as { kind?: string; externalId?: string; externalReference?: string };
    const at = new Date();
    if (p.kind === 'subscription.activated' && p.externalId && p.externalReference) {
      return [
        {
          kind: 'subscription.activated',
          externalId: p.externalId,
          externalReference: p.externalReference,
          activatedAt: at,
        },
      ];
    }
    if (p.kind === 'subscription.cancelled' && p.externalId && p.externalReference) {
      return [
        {
          kind: 'subscription.cancelled',
          externalId: p.externalId,
          externalReference: p.externalReference,
          cancelledAt: at,
        },
      ];
    }
    if (p.kind === 'subscription.payment_failed' && p.externalId && p.externalReference) {
      return [
        {
          kind: 'subscription.payment_failed',
          externalId: p.externalId,
          externalReference: p.externalReference,
          failedAt: at,
        },
      ];
    }
    return [];
  }
}
