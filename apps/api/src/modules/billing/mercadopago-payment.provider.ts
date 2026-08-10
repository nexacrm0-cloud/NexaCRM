import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentProvider,
  PaymentSubscriptionInput,
  PaymentSubscriptionResult,
  PaymentWebhookEvent,
} from './payment-provider.interface';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

interface MPPreapprovalResponse {
  id: string;
  status: 'pending' | 'authorized' | 'cancelled' | 'paused';
  init_point: string;
  sandbox_init_point?: string;
  collector_id: number;
  payer_email: string;
  reason?: string;
  external_reference?: string;
}

interface MPPreapprovalPlanResponse {
  id: string;
  reason: string;
  auto_recurring: {
    frequency: number;
    frequency_type: 'months' | 'days';
    transaction_amount: number;
    currency_id: string;
  };
  back_url: {
    success: string;
    failure: string;
    pending: string;
  };
}

interface MPWebhookPayload {
  id?: string;
  type?: string;
  topic?: string;
  data?: { id?: string };
  resource?: string;
  user_id?: number;
  date_created?: string;
  status?: string;
  external_reference?: string;
}

interface MPPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  external_reference?: string;
  preapproval_id?: string;
  transaction_amount: number;
  currency_id: string;
  date_approved?: string;
  date_created: string;
}

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  readonly kind = 'mercadopago';
  private readonly logger = new Logger(MercadoPagoProvider.name);
  private readonly axios: AxiosInstance;
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly initialized: boolean;

  constructor(private config: ConfigService) {
    this.accessToken = this.config.get<string>('MP_ACCESS_TOKEN') ?? '';
    this.baseUrl = this.config.get<string>('MP_API_BASE_URL') ?? 'https://api.mercadopago.com';
    this.initialized = !!this.accessToken;

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      maxRedirects: 2,
    });

    if (!this.initialized && this.config.get('NODE_ENV') === 'production') {
      this.logger.error('MP_ACCESS_TOKEN no seteado. MercadoPagoProvider inactivo.');
    }
  }

  async createSubscription(input: PaymentSubscriptionInput): Promise<PaymentSubscriptionResult> {
    this.assertInitialized();

    const amount = (input.amountCents / 100).toFixed(2);
    const frequencyType = input.interval === 'year' ? 'months' : 'months';
    const frequency = input.interval === 'year' ? 12 : 1;

    const body = {
      reason: input.description,
      external_reference: input.externalReference,
      auto_recurring: {
        frequency,
        frequency_type: frequencyType,
        transaction_amount: Number(amount),
        currency_id: this.normalizeCurrency(input.currency),
      },
      back_url: {
        success: input.successUrl,
        failure: input.failureUrl,
        pending: input.successUrl,
      },
      payer_email: input.customerEmail,
      ...(input.customerName ? { payer_first_name: input.customerName } : {}),
    };

    try {
      const { data } = await this.axios.post<MPPreapprovalResponse>('/preapproval', body);

      const approvalUrl = data.init_point ?? data.sandbox_init_point;
      const status = this.normalizeStatus(data.status);

      this.logger.log(
        `MP Preapproval created: id=${data.id} status=${data.status} ext_ref=${data.external_reference}`,
      );

      return {
        externalId: data.id,
        approvalUrl,
        status,
      };
    } catch (err) {
      this.logApiError('createSubscription', err);
      throw new InternalServerErrorException('No se pudo crear la suscripción en Mercado Pago.');
    }
  }

  async cancelSubscription(externalId: string): Promise<void> {
    this.assertInitialized();
    try {
      await this.axios.put(`/preapproval/${externalId}`, {
        status: 'cancelled',
      });
      this.logger.log(`MP Preapproval cancelled: ${externalId}`);
    } catch (err) {
      this.logApiError('cancelSubscription', err);
      throw new InternalServerErrorException('No se pudo cancelar la suscripción en Mercado Pago.');
    }
  }

  async parseWebhook(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<PaymentWebhookEvent[]> {
    if (!payload || typeof payload !== 'object') return [];

    // Verify signature if webhook secret is configured
    this.verifySignature(payload as Record<string, unknown>, headers);

    const p = payload as MPWebhookPayload;
    const topic = p.topic || p.type;
    const preapprovalId = p.data?.id ?? p.id;

    if (!topic || !preapprovalId) return [];

    // Mercado Pago sends notifications for preapproval (subscription) and payment
    if (topic !== 'preapproval' && topic !== 'payment') {
      this.logger.debug(`Ignoring MP webhook with topic=${topic}`);
      return [];
    }

    if (!this.initialized) {
      this.logger.warn(`Cannot fetch MP preapproval ${preapprovalId}: no access token`);
      return [];
    }

    try {
      if (topic === 'preapproval') {
        const { data } = await this.axios.get<MPPreapprovalResponse>(
          `/preapproval/${preapprovalId}`,
        );
        return this.normalizePreapprovalEvent(data, preapprovalId);
      } else {
        // Payment notification - fetch payment details and check if it's for a preapproval
        const { data } = await this.axios.get<MPPaymentResponse>(`/v1/payments/${preapprovalId}`);
        return this.normalizePaymentEvent(data);
      }
    } catch (err) {
      this.logApiError('parseWebhook-fetch', err);
      return [];
    }
  }

  private normalizePreapprovalEvent(
    data: MPPreapprovalResponse,
    preapprovalId: string,
  ): PaymentWebhookEvent[] {
    const externalReference = data.external_reference ?? '';
    const at = new Date();

    switch (data.status) {
      case 'authorized':
        return [
          {
            kind: 'subscription.activated',
            externalId: preapprovalId,
            externalReference,
            activatedAt: at,
          },
        ];
      case 'cancelled':
        return [
          {
            kind: 'subscription.cancelled',
            externalId: preapprovalId,
            externalReference,
            cancelledAt: at,
          },
        ];
      case 'paused':
        return [
          {
            kind: 'subscription.payment_failed',
            externalId: preapprovalId,
            externalReference,
            failedAt: at,
            reason: 'Pago pausado por Mercado Pago',
          },
        ];
      default:
        this.logger.debug(`MP webhook ${preapprovalId} status=${data.status}. Ignored.`);
        return [];
    }
  }

  private normalizePaymentEvent(data: MPPaymentResponse): PaymentWebhookEvent[] {
    const preapprovalId = data.preapproval_id;
    const externalReference = data.external_reference ?? '';
    const at = new Date(data.date_approved || data.date_created);

    if (!preapprovalId) return [];

    if (data.status === 'approved') {
      return [
        {
          kind: 'subscription.activated',
          externalId: String(preapprovalId),
          externalReference,
          activatedAt: at,
        },
      ];
    }

    if (data.status === 'rejected' || data.status === 'cancelled') {
      return [
        {
          kind: 'subscription.payment_failed',
          externalId: String(preapprovalId),
          externalReference,
          failedAt: at,
          reason: data.status_detail,
        },
      ];
    }

    return [];
  }

  private normalizeStatus(
    status: MPPreapprovalResponse['status'],
  ): PaymentSubscriptionResult['status'] {
    switch (status) {
      case 'authorized':
        return 'active';
      case 'pending':
        return 'pending';
      case 'cancelled':
        return 'cancelled';
      case 'paused':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private normalizeCurrency(currency: string): string {
    const c = currency.toUpperCase();
    const supported = ['ARS', 'BRL', 'MXN', 'COP', 'CLP', 'PEN', 'UYU', 'USD', 'EUR'];
    if (!supported.includes(c)) {
      this.logger.warn(`Currency ${c} no soportado por Mercado Pago. Default a ARS.`);
      return 'ARS';
    }
    return c;
  }

  private verifySignature(payload: Record<string, unknown>, headers: Record<string, string>): void {
    const sig = headers['x-signature'];
    const requestId = headers['x-request-id'];
    const webhookSecret = this.config.get<string>('MP_WEBHOOK_SECRET');

    if (!sig || !webhookSecret) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new BadRequestException('Webhook signature required');
      }
      return;
    }

    // 1. Parse signature: "ts=1234567890,v1=abcdef..."
    const parts = sig.split(',');
    let ts = '';
    let v1 = '';
    for (const part of parts) {
      if (part.startsWith('ts=')) ts = part.slice(3);
      if (part.startsWith('v1=')) v1 = part.slice(3);
    }

    if (!ts || !v1) {
      throw new BadRequestException('Invalid signature format');
    }

    // 2. Validate timestamp (prevent replay - max 5 min skew)
    const now = Math.floor(Date.now() / 1000);
    const tsNum = parseInt(ts, 10);
    if (Number.isNaN(tsNum) || Math.abs(now - tsNum) > 300) {
      throw new BadRequestException('Webhook timestamp expired');
    }

    // 3. Build manifest exactly as MP expects: "ts.{JSON.stringify(payload)}"
    const manifest = `${ts}.${JSON.stringify(payload)}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret!)
      .update(manifest)
      .digest('hex');

    // 4. Constant-time comparison (prevent timing attacks)
    const sigBuffer = Buffer.from(v1, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn(
        `MP webhook signature mismatch - requestId: ${headers['x-request-id'] || 'unknown'}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new InternalServerErrorException(
        'MercadoPagoProvider no configurado (falta MP_ACCESS_TOKEN).',
      );
    }
  }

  private logApiError(operation: string, err: unknown): void {
    const e = err as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };
    const status = e?.response?.status;
    const details = e?.response?.data?.message ?? e?.message ?? 'unknown';
    this.logger.error(`MP ${operation} failed: HTTP ${status ?? 'N/A'} - ${details}`);
    if (e && this.config.get('NODE_ENV') !== 'production') {
      this.logger.debug(`MP error body: ${JSON.stringify(e?.response?.data)}`);
    }
  }
}
