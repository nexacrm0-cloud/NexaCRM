/**
 * SECURITY TESTS — Vector 10 (Integrations / Webhook signatures)
 *
 * Validates MercadoPago webhook signature verification. The contract:
 *  - HMAC-SHA256 over `id:{data.id};request-id:{x-request-id};ts:{ts};`
 *  - timestamp must be within 5 minutes of server time (replay protection)
 *  - constant-time comparison via `crypto.timingSafeEqual`
 *
 * Any regression here would let an attacker forge payment events.
 */
import crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoProvider } from '../mercadopago-payment.provider';

function buildProvider(webhookSecret = 'test-webhook-secret'): MercadoPagoProvider {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'MP_WEBHOOK_SECRET') return webhookSecret;
      if (key === 'NODE_ENV') return 'production';
      if (key === 'MP_ACCESS_TOKEN') return 'test-token';
      return undefined;
    }),
  } as unknown as ConfigService;
  return new MercadoPagoProvider(config);
}

function buildManifest(dataId: string, requestId: string, ts: string): string {
  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId.toLowerCase()}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(';')};`;
}

describe('MercadoPago webhook signature verification', () => {
  const dataId = '1234567890';
  const requestId = 'req-abc-123';
  const ts = String(Date.now());

  it('accepts a valid HMAC signature with all manifest fields', () => {
    const provider = buildProvider();
    const manifest = buildManifest(dataId, requestId, ts);
    const v1 = crypto.createHmac('sha256', 'test-webhook-secret').update(manifest).digest('hex');
    const sig = `ts=${ts},v1=${v1}`;

    expect(() =>
      (provider as any).verifySignature(
        {},
        { 'x-signature': sig, 'x-request-id': requestId },
        { 'data.id': dataId },
      ),
    ).not.toThrow();
  });

  it('rejects a signature with a different secret', () => {
    const provider = buildProvider('correct-secret');
    const manifest = buildManifest(dataId, requestId, ts);
    const v1 = crypto.createHmac('sha256', 'WRONG-SECRET').update(manifest).digest('hex');
    const sig = `ts=${ts},v1=${v1}`;

    expect(() =>
      (provider as any).verifySignature(
        {},
        { 'x-signature': sig, 'x-request-id': requestId },
        { 'data.id': dataId },
      ),
    ).toThrow(/Invalid webhook signature/);
  });

  it('rejects a signature whose manifest does not match', () => {
    const provider = buildProvider();
    const wrongManifest = buildManifest('99999', requestId, ts);
    const v1 = crypto
      .createHmac('sha256', 'test-webhook-secret')
      .update(wrongManifest)
      .digest('hex');
    const sig = `ts=${ts},v1=${v1}`;

    expect(() =>
      (provider as any).verifySignature(
        {},
        { 'x-signature': sig, 'x-request-id': requestId },
        { 'data.id': dataId },
      ),
    ).toThrow(/Invalid webhook signature/);
  });

  it('rejects a timestamp older than 5 minutes (replay protection)', () => {
    const provider = buildProvider();
    const oldTs = String(Date.now() - 6 * 60 * 1000); // 6 min ago
    const manifest = buildManifest(dataId, requestId, oldTs);
    const v1 = crypto.createHmac('sha256', 'test-webhook-secret').update(manifest).digest('hex');
    const sig = `ts=${oldTs},v1=${v1}`;

    expect(() =>
      (provider as any).verifySignature(
        {},
        { 'x-signature': sig, 'x-request-id': requestId },
        { 'data.id': dataId },
      ),
    ).toThrow(/timestamp expired/);
  });

  it('rejects a malformed signature header', () => {
    const provider = buildProvider();
    expect(() =>
      (provider as any).verifySignature({}, { 'x-signature': 'not-a-real-signature' }, {}),
    ).toThrow();
  });

  it('rejects when signature header is missing in production', () => {
    const provider = buildProvider();
    expect(() =>
      (provider as any).verifySignature({}, { 'x-request-id': requestId }, { 'data.id': dataId }),
    ).toThrow(/signature required/);
  });

  it('accepts legacy seconds-form timestamps (tolerates ts < 1e12)', () => {
    const provider = buildProvider();
    const tsSeconds = String(Math.floor(Date.now() / 1000));
    const manifest = buildManifest(dataId, requestId, tsSeconds);
    const v1 = crypto.createHmac('sha256', 'test-webhook-secret').update(manifest).digest('hex');
    const sig = `ts=${tsSeconds},v1=${v1}`;

    expect(() =>
      (provider as any).verifySignature(
        {},
        { 'x-signature': sig, 'x-request-id': requestId },
        { 'data.id': dataId },
      ),
    ).not.toThrow();
  });
});
