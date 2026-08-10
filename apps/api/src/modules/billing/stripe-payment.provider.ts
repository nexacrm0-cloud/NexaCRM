import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type {
  PaymentProvider,
  PaymentSubscriptionInput,
  PaymentSubscriptionResult,
  PaymentWebhookEvent,
} from './payment-provider.interface';

interface StripeCustomerResponse {
  id: string;
  email: string;
}

interface StripeProductResponse {
  id: string;
  name: string;
}

interface StripePriceResponse {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: 'month' | 'year' };
}

interface StripeSubscriptionResponse {
  id: string;
  status: Stripe.Subscription.Status;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: { data: { price: { id: string; product: string } }[] };
  customer: string;
  metadata: Record<string, string>;
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly kind = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;
  private readonly initialized: boolean;

  // Map internal plan slugs to product names — extend as needed
  private static readonly PLAN_METADATA: Record<string, { name: string; description: string }> = {
    starter: { name: 'Starter', description: 'Plan básico para equipos pequeños' },
    pro: { name: 'Pro', description: 'Plan completo para equipos en crecimiento' },
    enterprise: { name: 'Enterprise', description: 'Plan avanzado para organizaciones grandes' },
  };

  constructor(private config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';

    this.initialized = !!secretKey;
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      telemetry: false,
      maxNetworkRetries: 2,
      timeout: 15000,
    });

    if (!this.initialized && this.config.get('NODE_ENV') === 'production') {
      this.logger.error('STRIPE_SECRET_KEY no seteado. StripePaymentProvider inactivo.');
    }
  }

  /**
   * Create a Stripe subscription for a plan.
   * On-demand: creates Customer, Product, Price if they don't exist,
   * then creates the Subscription in "incomplete" state so the client
   * can be redirected to Stripe Checkout (approvalUrl).
   */
  async createSubscription(input: PaymentSubscriptionInput): Promise<PaymentSubscriptionResult> {
    this.assertInitialized();

    try {
      // 1. Ensure Customer exists (or create)
      const customer = await this.getOrCreateCustomer(input.customerEmail, input.customerName);

      // 2. Ensure Product + Price exist for this plan (on-demand)
      const { priceId, productId } = await this.getOrCreatePrice(
        input.externalReference,
        input.amountCents,
        input.currency,
        input.interval,
        input.description,
      );

      // 3. Create Subscription in "incomplete" status with pending_setup_intent
      //    This returns a client_secret that we could use with Stripe.js,
      //    but for simplicity we create a Checkout Session for the approval URL.
      //    Alternative: use Subscription.create({ payment_behavior: 'default_incomplete', ... })
      //    and redirect to the client_secret. We'll use Checkout Session here
      //    because it handles SCA, taxes, and payment method collection automatically.

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: input.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: input.failureUrl,
        metadata: {
          external_reference: input.externalReference,
          organization_id: input.externalReference, // keep for webhook correlation
        },
        subscription_data: {
          metadata: {
            external_reference: input.externalReference,
            plan_slug: input.externalReference.split('_')[0], // e.g., "pro_org123" -> "pro"
          },
        },
        // Allow promotion codes if you enable them later
        // allow_promotion_codes: true,
      });

      // The subscription isn't created yet — it will be created when the
      // checkout session completes. We return the session ID as externalId
      // and the checkout URL as approvalUrl. The webhook will normalize
      // 'checkout.session.completed' -> subscription.activated with the
      // actual Stripe subscription ID.
      return {
        externalId: session.id,
        approvalUrl: session.url,
        status: 'pending',
      };
    } catch (err) {
      this.logApiError('createSubscription', err);
      throw new InternalServerErrorException('No se pudo crear la suscripción en Stripe.');
    }
  }

  /**
   * Cancel at period end — the subscription stays active until the
   * current billing period ends, then Stripe cancels it automatically.
   * This is the customer-friendly default (no immediate loss of access).
   */
  async cancelSubscription(externalId: string): Promise<void> {
    this.assertInitialized();
    try {
      // The externalId could be either a Stripe Subscription ID or a Checkout Session ID.
      // If it's a Checkout Session ID (from our createSubscription), we need to
      // find the actual subscription. For simplicity, we assume externalId is
      // the Subscription ID — the webhook handler stores the mapping.
      // If we only have a session ID, we can list subscriptions for the customer.
      await this.stripe.subscriptions.update(externalId, {
        cancel_at_period_end: true,
      });
      this.logger.log(`Stripe subscription set to cancel at period end: ${externalId}`);
    } catch (err) {
      this.logApiError('cancelSubscription', err);
      throw new InternalServerErrorException('No se pudo cancelar la suscripción en Stripe.');
    }
  }

  /**
   * Parse and verify Stripe webhook payload, then normalize to our
   * internal PaymentWebhookEvent format.
   */
  async parseWebhook(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<PaymentWebhookEvent[]> {
    if (!payload || typeof payload !== 'object') return [];

    // 1. Verify signature
    const sig = headers['stripe-signature'] as string | undefined;
    if (!sig) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new BadRequestException('Missing stripe-signature header');
      }
      this.logger.warn('Missing stripe-signature header (dev mode: continuing)');
    }

    let event: Stripe.Event;
    try {
      if (sig && this.webhookSecret) {
        event = this.stripe.webhooks.constructEvent(
          payload as Buffer | string,
          sig,
          this.webhookSecret,
        );
      } else {
        // Dev mode without secret — just cast
        event = payload as Stripe.Event;
      }
    } catch (err) {
      this.logger.warn(
        `Stripe webhook signature verification failed: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // 2. Normalize only events we care about
    const events: PaymentWebhookEvent[] = [];

    switch (event.type) {
      case 'checkout.session.completed': {
        // The Checkout Session completed — a subscription was created.
        // Retrieve the subscription to get the real subscription ID and status.
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && typeof session.subscription === 'string') {
          const subscription = await this.stripe.subscriptions.retrieve(session.subscription);
          events.push(
            ...this.normalizeSubscriptionEvent(
              subscription,
              session.metadata?.external_reference ?? '',
            ),
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        events.push(
          ...this.normalizeSubscriptionEvent(
            subscription,
            subscription.metadata?.external_reference ?? '',
          ),
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        events.push({
          kind: 'subscription.cancelled',
          externalId: subscription.id,
          externalReference: subscription.metadata?.external_reference ?? '',
          cancelledAt: new Date(
            subscription.canceled_at ? subscription.canceled_at * 1000 : Date.now(),
          ),
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // invoice.subscription exists at runtime but not in types; cast to access
        const subscriptionId = (invoice as any).subscription;
        if (subscriptionId && typeof subscriptionId === 'string') {
          const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
          events.push({
            kind: 'subscription.payment_failed',
            externalId: subscription.id,
            externalReference: subscription.metadata?.external_reference ?? '',
            failedAt: new Date(
              invoice.status_transitions?.finalized_at
                ? invoice.status_transitions.finalized_at * 1000
                : Date.now(),
            ),
            reason: invoice.last_finalization_error?.message ?? 'Payment failed',
          });
        }
        break;
      }

      default:
        this.logger.debug(`Ignoring Stripe webhook type: ${event.type}`);
    }

    return events;
  }

  // ===== Helpers ==============================================================

  private async getOrCreateCustomer(email: string, name?: string): Promise<StripeCustomerResponse> {
    // Try to find existing customer by email
    const customers = await this.stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      return { id: customers.data[0].id, email: customers.data[0].email ?? email };
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email,
      name: name ?? undefined,
      metadata: { source: 'nexa-crm' },
    });
    this.logger.log(`Created Stripe customer: ${customer.id} for ${email}`);
    return { id: customer.id, email };
  }

  private async getOrCreatePrice(
    planSlug: string,
    amountCents: number,
    currency: string,
    interval: 'month' | 'year',
    description: string,
  ): Promise<{ priceId: string; productId: string }> {
    // Look up existing product by metadata.plan_slug (filter manually since Stripe doesn't support metadata filter on list)
    const products = await this.stripe.products.list({
      limit: 100,
      active: true,
    });

    // Filter manually by metadata.plan_slug
    const product = products.data.find((p) => p.metadata?.plan_slug === planSlug);

    let productId: string;

    if (product) {
      productId = product.id;
    } else {
      // Create new product
      const meta = StripePaymentProvider.PLAN_METADATA[planSlug] ?? {
        name: planSlug.charAt(0).toUpperCase() + planSlug.slice(1),
        description,
      };

      const product = await this.stripe.products.create({
        name: meta.name,
        description: meta.description,
        metadata: { plan_slug: planSlug },
        active: true,
      });
      productId = product.id;
      this.logger.log(`Created Stripe product: ${productId} (${planSlug})`);
    }

    // Check if a price with this amount/currency/interval already exists for this product
    const prices = await this.stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });

    const matchingPrice = prices.data.find(
      (p) =>
        p.unit_amount === amountCents &&
        p.currency === currency.toLowerCase() &&
        p.recurring?.interval === interval,
    );

    if (matchingPrice) {
      return { priceId: matchingPrice.id, productId };
    }

    // Create new price
    const price = await this.stripe.prices.create({
      product: productId,
      unit_amount: amountCents,
      currency: currency.toLowerCase(),
      recurring: { interval },
      metadata: { plan_slug: planSlug }, // track which product this price belongs to
      active: true,
    });
    this.logger.log(
      `Created Stripe price: ${price.id} (${amountCents / 100} ${currency.toUpperCase()}/${interval})`,
    );
    return { priceId: price.id, productId };
  }

  private normalizeSubscriptionEvent(
    subscription: Stripe.Subscription,
    externalReference: string,
  ): PaymentWebhookEvent[] {
    const at = new Date();
    const events: PaymentWebhookEvent[] = [];

    // Only emit events for statuses we care about
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        events.push({
          kind: 'subscription.activated',
          externalId: subscription.id,
          externalReference: externalReference || subscription.metadata?.external_reference || '',
          activatedAt: at,
        });
        break;

      case 'canceled':
        events.push({
          kind: 'subscription.cancelled',
          externalId: subscription.id,
          externalReference: externalReference || subscription.metadata?.external_reference || '',
          cancelledAt: new Date(
            (subscription.canceled_at ?? Date.now()) * (subscription.canceled_at ? 1000 : 1),
          ),
        });
        break;

      case 'past_due':
      case 'unpaid':
        events.push({
          kind: 'subscription.payment_failed',
          externalId: subscription.id,
          externalReference: externalReference || subscription.metadata?.external_reference || '',
          failedAt: at,
          reason: `Subscription status: ${subscription.status}`,
        });
        break;

      default:
        // incomplete, incomplete_expired, paused — log but don't emit
        this.logger.debug(
          `Stripe subscription ${subscription.id} status=${subscription.status}. No event emitted.`,
        );
    }

    return events;
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new InternalServerErrorException(
        'StripePaymentProvider no configurado (falta STRIPE_SECRET_KEY).',
      );
    }
  }

  private logApiError(operation: string, err: unknown): void {
    const e = err as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
      statusCode?: number;
    };
    const status = e?.statusCode ?? e?.response?.status;
    const details = e?.response?.data?.message ?? e?.message ?? 'unknown';
    this.logger.error(`Stripe ${operation} failed: HTTP ${status ?? 'N/A'} - ${details}`);
    if (e && this.config.get('NODE_ENV') !== 'production') {
      this.logger.debug(`Stripe error body: ${JSON.stringify(e?.response?.data ?? e)}`);
    }
  }
}
