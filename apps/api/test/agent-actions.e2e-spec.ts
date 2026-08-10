import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import * as express from 'express';
import cookieParser from 'cookie-parser';
import { ThrottlerModule } from '@nestjs/throttler';
import { AgentActionsController } from '../src/modules/agents/agent-actions.controller';
import { AgentApiKeyGuard } from '../src/common/guards/agent-api-key.guard';
import { PrismaService } from '@nexa/database';

// E2E tests for the agent-actions Zod schemas. These prove the @Body(new
// ZodPipe(...)) actually rejects malformed payloads (extra fields, wrong
// types, missing required fields, oversized values) with a 400 before any
// Prisma write happens — which is the security contract the schemas document
// in their comments.
//
// We instantiate ONLY AgentActionsController against a mock Prisma and a
// no-op AgentApiKeyGuard that fakes an authenticated org. This keeps the
// tests runnable without Postgres / Redis / n8n.

describe('agent-actions Zod schemas (e2e rejection of malformed payloads)', () => {
  let app: INestApplication;

  const mockPrisma = {
    client: {
      create: jest
        .fn()
        .mockImplementation((args: any) => Promise.resolve({ ...args.data, id: 'client_new' })),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    pipelineStage: {
      findFirst: jest.fn().mockResolvedValue({ id: 'stage_1', position: 0 }),
    },
    deal: {
      create: jest
        .fn()
        .mockImplementation((args: any) => Promise.resolve({ ...args.data, id: 'deal_new' })),
    },
    task: {
      create: jest
        .fn()
        .mockImplementation((args: any) => Promise.resolve({ ...args.data, id: 'task_new' })),
    },
    quote: {
      create: jest.fn().mockResolvedValue({ id: 'q_new', items: [] }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ nextval: 1 }]),
  };

  const fakeGuard = {
    canActivate: (ctx: ExecutionContext) => {
      const req = ctx.switchToHttp().getRequest();
      req.organizationId = 'org_1';
      req.agentSubscription = { agent: { id: 'agent_1' } };
      req.agent = { id: 'agent_1' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: 600 },
          { name: 'search', ttl: 60_000, limit: 600 },
          { name: 'writes', ttl: 60_000, limit: 600 },
        ]),
      ],
      controllers: [AgentActionsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    })
      .overrideGuard(AgentApiKeyGuard)
      .useValue(fakeGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    (app as any).use(express.json({ limit: '1mb' }));
    app.use(cookieParser());
    app.useGlobalPipes(
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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /agent-actions/clients', () => {
    it('accepts a well-formed client', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/clients')
        .send({ companyName: 'Acme SA', phone: '5491133221100' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.client.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a client missing companyName', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/clients')
        .send({ phone: '5491133221100' });
      expect(res.status).toBe(400);
      expect(mockPrisma.client.create).not.toHaveBeenCalled();
    });

    it('rejects a client with an invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/clients')
        .send({ companyName: 'Acme', email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('rejects an oversize companyName (>255)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/clients')
        .send({ companyName: 'x'.repeat(256) });
      expect(res.status).toBe(400);
    });

    it('rejects too many tags (>50)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/clients')
        .send({ companyName: 'Acme', tags: Array.from({ length: 51 }, () => 't') });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /agent-actions/clients/search', () => {
    it('accepts a search by phone', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/agent-actions/clients/search')
        .query({ phone: '5491133221100' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects a search with neither phone nor email', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/agent-actions/clients/search')
        .query({});
      expect(res.status).toBe(400);
    });

    it('rejects a search with an invalid email', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/agent-actions/clients/search')
        .query({ email: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /agent-actions/deals', () => {
    it('accepts a well-formed deal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/deals')
        .send({ title: 'New sale' });
      expect(res.status).toBe(201);
      expect(mockPrisma.deal.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a deal with value < 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/deals')
        .send({ title: 'X', value: -1 });
      expect(res.status).toBe(400);
      expect(mockPrisma.deal.create).not.toHaveBeenCalled();
    });

    it('rejects a deal with probability > 100', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/deals')
        .send({ title: 'X', probability: 200 });
      expect(res.status).toBe(400);
    });

    it('rejects a deal with an oversize title', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/deals')
        .send({ title: 'x'.repeat(256) });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /agent-actions/tasks', () => {
    it('accepts a well-formed task', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/tasks')
        .send({ title: 'Follow up' });
      expect(res.status).toBe(201);
      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a task with an invalid priority enum', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/tasks')
        .send({ title: 'X', priority: 'CRITICAL' });
      expect(res.status).toBe(400);
    });

    it('rejects a task with an invalid dueDate', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/tasks')
        .send({ title: 'X', dueDate: 'not-a-date' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /agent-actions/quotes', () => {
    const validQuote = {
      title: 'Cotización A',
      clientId: 'client_1',
      items: [{ description: 'Item 1', quantity: 2, unitPrice: 100 }],
    };

    it('accepts a well-formed quote', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/quotes')
        .send(validQuote);
      expect(res.status).toBe(201);
      expect(mockPrisma.quote.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a quote missing clientId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/quotes')
        .send({ ...validQuote, clientId: undefined });
      expect(res.status).toBe(400);
    });

    it('rejects a quote with no items', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/quotes')
        .send({ ...validQuote, items: [] });
      expect(res.status).toBe(400);
    });

    it('rejects a quote item with quantity <= 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/quotes')
        .send({ ...validQuote, items: [{ description: 'X', quantity: 0, unitPrice: 10 }] });
      expect(res.status).toBe(400);
    });

    it('rejects a quote item with unitPrice > 1_000_000_000', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/quotes')
        .send({
          ...validQuote,
          items: [{ description: 'X', quantity: 1, unitPrice: 2_000_000_000 }],
        });
      expect(res.status).toBe(400);
    });

    it('rejects a quote with taxRate > 100', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/agent-actions/quotes')
        .send({ ...validQuote, taxRate: 200 });
      expect(res.status).toBe(400);
    });
  });
});
