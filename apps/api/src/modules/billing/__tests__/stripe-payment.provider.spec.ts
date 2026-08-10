import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripePaymentProvider } from '../stripe-payment.provider';
import Stripe from 'stripe';

// Unit tests for StripePaymentProvider.
// We mock the Stripe SDK to avoid network calls and test the logic in isolation.

const mockStripe = {
  customers: {
    list: jest.fn(),
    create: jest.fn(),
  },
  products: {
    list: jest.fn(),
    create: jest.fn(),
  },
  prices: {
    list: jest.fn(),
    create: jest.fn(),
  },
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

const mockConfig = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      STRIPE_SECRET_KEY: 'sk_test_fake',
      STRIPE_WEBHOOK_SECRET: 'whsec_fake',
      NODE_ENV: 'test',
    };
    return values[key];
  }),
};

describe('StripePaymentProvider', () => {
  let provider: StripePaymentProvider;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_fake',
        STRIPE_WEBHOOK_SECRET: 'whsec_fake',
        NODE_ENV: 'test',
      };
      return values[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [StripePaymentProvider, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    provider = module.get<StripePaymentProvider>(StripePaymentProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const validInput = {
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      description: 'Pro Plan',
      amountCents: 2900,
      currency: 'USD',
      interval: 'month' as const,
      externalReference: 'pro',
      successUrl: 'https://app.example.com/success',
      failureUrl: 'https://app.example.com/failure',
    };

    beforeEach(() => {
      // Default mocks for a successful flow
      mockStripe.customers.list.mockResolvedValue({ data: [] });
      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_test123',
        email: 'test@example.com',
      });
      mockStripe.products.list.mockResolvedValue({ data: [] });
      mockStripe.products.create.mockResolvedValue({ id: 'prod_test123', name: 'Pro' });
      mockStripe.prices.list.mockResolvedValue({ data: [] });
      mockStripe.prices.create.mockResolvedValue({
        id: 'price_test123',
        unit_amount: 2900,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
      mockStripe.checkout.sessions.create.mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
      });
    });

    it('creates a customer if none exists', async () => {
      const result = await provider.createSubscription(validInput);
      expect(result.externalId).toBe('cs_test123');
      expect(result.approvalUrl).toContain('checkout.stripe.com');
      expect(result.status).toBe('pending');
      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', name: 'Test User' }),
      );
    });

    it('reuses existing customer by email', async () => {
      mockStripe.customers.list.mockResolvedValue({
        data: [{ id: 'cus_existing', email: 'test@example.com' }],
      });
      await provider.createSubscription(validInput);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('creates product on first use for a plan', async () => {
      await provider.createSubscription(validInput);
      expect(mockStripe.products.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pro', metadata: { plan_slug: 'pro' } }),
      );
    });

    it('reuses existing product for same plan', async () => {
      // The planSlug comes from externalReference, so it must match
      mockStripe.products.list.mockResolvedValue({
        data: [{ id: 'prod_existing', metadata: { plan_slug: 'pro' } }],
      });
      await provider.createSubscription(validInput);
      expect(mockStripe.products.create).not.toHaveBeenCalled();
    });

    it('creates price with correct amount/currency/interval', async () => {
      await provider.createSubscription(validInput);
      expect(mockStripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          unit_amount: 2900,
          currency: 'usd',
          recurring: { interval: 'month' },
        }),
      );
    });

    it('reuses existing price with same params', async () => {
      mockStripe.prices.list.mockResolvedValue({
        data: [
          {
            id: 'price_existing',
            unit_amount: 2900,
            currency: 'usd',
            recurring: { interval: 'month' },
          },
        ],
      });
      await provider.createSubscription(validInput);
      expect(mockStripe.prices.create).not.toHaveBeenCalled();
    });

    it('throws InternalServerErrorException when Stripe throws', async () => {
      mockStripe.customers.list.mockRejectedValue(new Error('Stripe down'));
      await expect(provider.createSubscription(validInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('throws InternalServerErrorException when not initialized', async () => {
      // Create a provider without secret key
      const module = await Test.createTestingModule({
        providers: [
          StripePaymentProvider,
          {
            provide: ConfigService,
            useValue: { get: (k: string) => (k === 'STRIPE_SECRET_KEY' ? '' : 'test') },
          },
        ],
      }).compile();
      const uninitialized = module.get(StripePaymentProvider);
      await expect(uninitialized.createSubscription(validInput)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('calls stripe.subscriptions.update with cancel_at_period_end=true', async () => {
      mockStripe.subscriptions.update.mockResolvedValue({
        id: 'sub_test123',
        cancel_at_period_end: true,
      });
      await provider.cancelSubscription('sub_test123');
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        cancel_at_period_end: true,
      });
    });

    it('throws on Stripe error', async () => {
      mockStripe.subscriptions.update.mockRejectedValue(new Error('Not found'));
      await expect(provider.cancelSubscription('sub_test123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('parseWebhook', () => {
    const validEvent = {
      id: 'evt_test123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test123',
          subscription: 'sub_test123',
          metadata: { external_reference: 'pro_org123' },
        },
      },
    };
    const validSig = 't=1234567890,v1=fake_signature';

    beforeEach(() => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test123',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test123',
            subscription: 'sub_test123',
            metadata: { external_reference: 'pro' },
          },
        },
      });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        metadata: { external_reference: 'pro' },
      });
    });

    it('verifies signature in production', async () => {
      const headers = { 'stripe-signature': validSig };
      await provider.parseWebhook(validEvent, headers);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        validEvent,
        validSig,
        'whsec_fake',
      );
    });

    it('throws BadRequestException on invalid signature in production', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      const headers = { 'stripe-signature': validSig };
      await expect(provider.parseWebhook(validEvent, headers)).rejects.toThrow(BadRequestException);
    });

    it('skips signature verification in dev/test when secret not set', async () => {
      // Mock config without webhook secret
      const module = await Test.createTestingModule({
        providers: [
          StripePaymentProvider,
          {
            provide: ConfigService,
            useValue: {
              get: (k: string) =>
                k === 'STRIPE_SECRET_KEY' ? 'sk_test' : k === 'STRIPE_WEBHOOK_SECRET' ? '' : 'test',
            },
          },
        ],
      }).compile();
      const devProvider = module.get(StripePaymentProvider);
      // Should not throw, just cast
      const events = await devProvider.parseWebhook(validEvent, { 'stripe-signature': validSig });
      expect(Array.isArray(events)).toBe(true);
    });

    it('normalizes checkout.session.completed to subscription.activated', async () => {
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        metadata: { external_reference: 'pro' },
      });
      const events = await provider.parseWebhook(validEvent, { 'stripe-signature': validSig });
      expect(events).toHaveLength(1);
      expect(events[0].kind).toBe('subscription.activated');
      expect(events[0].externalId).toBe('sub_test123');
    });

    it('normalizes customer.subscription.updated to activated/cancelled/payment_failed', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test123',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test123',
            status: 'canceled',
            metadata: { external_reference: 'pro' },
            canceled_at: 1234567890,
          },
        },
      });
      const events = await provider.parseWebhook(
        { type: 'customer.subscription.updated' },
        { 'stripe-signature': validSig },
      );
      expect(events[0].kind).toBe('subscription.cancelled');
    });

    it('normalizes customer.subscription.deleted to cancelled', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test123',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test123',
            metadata: { external_reference: 'pro' },
            canceled_at: 1234567890,
          },
        },
      });
      const events = await provider.parseWebhook(
        { type: 'customer.subscription.deleted' },
        { 'stripe-signature': validSig },
      );
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.kind).toBe('subscription.cancelled');
      if (ev.kind === 'subscription.cancelled') expect(ev.cancelledAt).toBeInstanceOf(Date);
    });

    it('normalizes invoice.payment_failed to payment_failed', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test123',
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'in_test123',
            subscription: 'sub_test123',
            status_transitions: { finalized_at: 1234567890 },
            last_finalization_error: { message: 'Card declined' },
          },
        },
      });
      mockStripe.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_test123',
        status: 'past_due',
        metadata: { external_reference: 'pro' },
      });
      const events = await provider.parseWebhook(
        { type: 'invoice.payment_failed' },
        { 'stripe-signature': validSig },
      );
      expect(events).toHaveLength(1);
      const ev = events[0];
      expect(ev.kind).toBe('subscription.payment_failed');
      if (ev.kind === 'subscription.payment_failed') expect(ev.reason).toContain('Card declined');
    });

    it('ignores unknown event types', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test123',
        type: 'unknown.type',
        data: {},
      });
      const events = await provider.parseWebhook(
        { type: 'unknown.type' },
        { 'stripe-signature': validSig },
      );
      expect(events).toHaveLength(0);
    });
  });
});
