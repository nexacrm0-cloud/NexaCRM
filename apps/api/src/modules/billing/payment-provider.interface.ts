export type PaymentSubscriptionInput = {
  customerEmail: string;
  customerName?: string;
  description: string;
  /** In cents. */
  amountCents: number;
  /** Currency ISO 4217, e.g. "ARS", "USD". */
  currency: string;
  /** Recurrence unit. */
  interval: 'month' | 'year';
  /** External referral tag. */
  externalReference: string;
  /** A success URL the client can be redirected to. */
  successUrl: string;
  /** A failure URL. */
  failureUrl: string;
};

export type PaymentSubscriptionResult = {
  /** The provider-managed subscription id; persists with us. */
  externalId: string;
  /** Where to send the customer to actually pay. */
  approvalUrl: string | null;
  /** Status right after creation. */
  status: 'pending' | 'active' | 'cancelled' | 'failed';
};

export interface PaymentProvider {
  readonly kind: string;
  createSubscription(input: PaymentSubscriptionInput): Promise<PaymentSubscriptionResult>;
  cancelSubscription(externalId: string): Promise<void>;
  /**
   * Parse a webhook payload from the provider and normalize it.
   * The result is a list of normalized events so multiple can be returned at once.
   * `query` carries the incoming request's query string params (used by
   * Mercado Pago's signature manifest which references `data.id` from the URL).
   */
  parseWebhook(
    payload: unknown,
    headers: Record<string, string>,
    query?: Record<string, unknown>,
  ): Promise<PaymentWebhookEvent[]>;
}

export type PaymentWebhookEvent =
  | {
      kind: 'subscription.activated';
      externalId: string;
      externalReference: string;
      activatedAt: Date;
    }
  | {
      kind: 'subscription.cancelled';
      externalId: string;
      externalReference: string;
      cancelledAt: Date;
    }
  | {
      kind: 'subscription.payment_failed';
      externalId: string;
      externalReference: string;
      failedAt: Date;
      reason?: string;
    };
