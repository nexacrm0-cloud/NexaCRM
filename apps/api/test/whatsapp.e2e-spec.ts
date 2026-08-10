import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { createHmac } from 'crypto';
import * as express from 'express';
import cookieParser from 'cookie-parser';
import { ThrottlerModule } from '@nestjs/throttler';
import { WhatsAppController } from '../src/modules/whatsapp/whatsapp.controller';
import { WhatsAppService } from '../src/modules/whatsapp/whatsapp.service';
import { HmacService } from '../src/common/services/hmac.service';
import { ZodPipe } from '../src/common/pipes/zod.pipe';

// E2E tests for the WhatsApp webhook endpoint that prove the security
// contract the controller documents in code comments is actually enforced:
//
//   1. HMAC signature is checked BEFORE Zod validation, so an unsigned
//      malformed payload gets 401 (unauthorized) — NOT 400 (validation). If
//      Zod ran first, an attacker could probe the expected envelope shape by
//      watching which payloads return 400 vs 401.
//   2. A signed payload that fails Zod gets 400 (the schema is the real
//      contract Meta must satisfy; a 400 here is legitimate feedback).
//   3. A signed, well-formed text-message payload is dispatched to the
//      WhatsAppService.handleIncomingMessage.
//   4. A signed, well-formed status payload (no messages) is routed to
//      handleStatusCallback.
//
// These tests do NOT instantiate the full AppModule (no DB / no Redis): they
// mount only WhatsAppController against fakes of its two dependencies, which
// is what makes them runnable in CI without docker-compose.

function sign(body: object, appSecret: string): string {
  const raw = JSON.stringify(body);
  return 'sha256=' + createHmac('sha256', appSecret).update(raw).digest('hex');
}

const validTextPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { phone_number_id: '12345', display_phone_number: '15550175508' },
            contacts: [{ profile: { name: 'John' }, wa_id: '5491133221100' }],
            messages: [
              {
                id: 'wamid.HBgL',
                type: 'text',
                from: '5491133221100',
                timestamp: '1700000000',
                text: { body: 'Hola, quiero info' },
              },
            ],
          },
        },
      ],
    },
  ],
};

const validStatusPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          field: 'messages',
          value: {
            statuses: [
              {
                id: 'wamid.HBgL',
                status: 'delivered',
                recipient_id: '5491133221100',
                timestamp: '1700000000',
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('WhatsApp webhook e2e (HMAC + Zod ordering)', () => {
  let app: INestApplication;
  const APP_SECRET = 'integration-app-secret-for-tests';

  const whatsappServiceMock = {
    handleIncomingMessage: jest
      .fn()
      .mockResolvedValue({ status: 'dispatched', executionId: 'exec_1' }),
    handleStatusCallback: jest.fn().mockResolvedValue({ status: 'received' }),
  };

  // A real HmacService — we want the actual timingSafeEqual code path under
  // test, not a stub. Injecting the real one keeps the test honest.
  const hmacService = new HmacService();

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = APP_SECRET;
    // Make sure the throttler has a default config so the @Throttle decorator
    // blowups if a bucket is missing.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }])],
      controllers: [WhatsAppController],
      providers: [
        { provide: WhatsAppService, useValue: whatsappServiceMock },
        { provide: HmacService, useValue: hmacService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    // Mirror main.ts: keep raw body so the HmacService can verify against it.
    const rawBodyMap = new WeakMap<object, Buffer>();
    (app as any).use(
      express.json({
        limit: '1mb',
        verify: (req: any, _res, buf: Buffer) => {
          req.rawBody = Buffer.from(buf);
        },
      }),
    );
    app.use(cookieParser());
    app.useGlobalPipes(
      // Mirror main.ts config so ZodPipe and ValidationPipe behave the same.
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.WHATSAPP_APP_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 (NOT 400) when the signature is missing — proves HMAC runs before Zod', async () => {
    // Payload is malformed (no `object` literal) but unsigned: the test
    // asserts we never reach Zod — we get 401, not a validation 400.
    const malformed = { wrongShape: true };
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .send(malformed);
    expect(res.status).toBe(401);
    expect(whatsappServiceMock.handleIncomingMessage).not.toHaveBeenCalled();
    expect(whatsappServiceMock.handleStatusCallback).not.toHaveBeenCalled();
  });

  it('returns 401 when the signature is present but wrong', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', 'sha256=deadbeef'.repeat(8))
      .send(validTextPayload);
    expect(res.status).toBe(401);
    expect(whatsappServiceMock.handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('returns 400 when the signature is valid but the payload fails Zod', async () => {
    // Tamper the envelope AFTER signing-meta expects a known shape: drop the
    // `object` literal so Zod rejects. We sign the tampered bytes, so HMAC
    // passes — then Zod rejects. This is the behavior we want: signed-but-
    // malformed = 400 (legitimate feedback), NOT 200.
    const malformed = { ...validTextPayload, object: 'instagram' };
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', sign(malformed, APP_SECRET))
      .send(malformed);
    expect(res.status).toBe(400);
    expect(whatsappServiceMock.handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('returns 200 and dispatches when signature is valid and payload matches the schema (text)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', sign(validTextPayload, APP_SECRET))
      .send(validTextPayload);
    expect(res.status).toBe(200);
    expect(whatsappServiceMock.handleIncomingMessage).toHaveBeenCalledTimes(1);
    const call = whatsappServiceMock.handleIncomingMessage.mock.calls[0][0];
    expect(call.messageId).toBe('wamid.HBgL');
    expect(call.from).toBe('5491133221100');
    expect(call.messageBody).toBe('Hola, quiero info');
    expect(whatsappServiceMock.handleStatusCallback).not.toHaveBeenCalled();
  });

  it('routes a signed status payload to handleStatusCallback', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', sign(validStatusPayload, APP_SECRET))
      .send(validStatusPayload);
    expect(res.status).toBe(200);
    expect(whatsappServiceMock.handleStatusCallback).toHaveBeenCalledTimes(1);
    expect(whatsappServiceMock.handleIncomingMessage).not.toHaveBeenCalled();
    const call = whatsappServiceMock.handleStatusCallback.mock.calls[0][0];
    expect(call.messageId).toBe('wamid.HBgL');
    expect(call.status).toBe('delivered');
  });

  it('rejects a signed payload with an unknown status enum value', async () => {
    const tampered = {
      ...validStatusPayload,
      entry: [
        {
          ...validStatusPayload.entry[0],
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [{ id: 'wamid', status: 'totally_made_up_status' }],
              },
            },
          ],
        },
      ],
    };
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', sign(tampered, APP_SECRET))
      .send(tampered);
    expect(res.status).toBe(400);
    expect(whatsappServiceMock.handleStatusCallback).not.toHaveBeenCalled();
  });

  it('rejects a signed payload missing the messages[].id (cannot dedupe)', async () => {
    const tampered = {
      ...validTextPayload,
      entry: [
        {
          ...validTextPayload.entry[0],
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    type: 'text',
                    from: '5491133221100',
                    timestamp: '1700000000',
                    text: { body: 'hi' },
                    // id omitted
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', sign(tampered, APP_SECRET))
      .send(tampered);
    expect(res.status).toBe(400);
    expect(whatsappServiceMock.handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('sends a signed, well-formed payload with `object` set to a non-WhatsApp literal to 400 (forced test of literal)', async () => {
    // This is intentionally redundant with the "malformed" test above but
    // pinned here as a regression marker: if anyone ever relaxes the
    // z.literal('whatsapp_business_account') to a z.string() this test goes
    // red before the webhook silently accepts a forged envelope.
    const forged = { ...validTextPayload, object: 'whatsapp_business_enumeration_attack' };
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/whatsapp/incoming')
      .set('x-hub-signature-256', sign(forged, APP_SECRET))
      .send(forged);
    expect(res.status).toBe(400);
  });
});
