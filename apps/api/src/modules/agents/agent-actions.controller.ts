import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '@nexa/database';
import { AgentApiKeyGuard } from '../../common/guards/agent-api-key.guard';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import {
  agentCreateClientSchema,
  agentSearchClientQuerySchema,
  agentCreateDealSchema,
  agentCreateTaskSchema,
  agentCreateQuoteSchema,
} from '@nexa/shared';

// Two dedicated throttler buckets, keyed per-agent by the UserOrIpThrottlerGuard
// (which falls back to IP for unauthenticated reqs). Decoupling search from
// writes means a chatty inbound WhatsApp conversation that does many
// searchClient lookups per message can't starve the create-* endpoints, and a
// runaway loop calling createDeal can't suppress legitimate concurrent
// searches. Each bucket has its own limit and TTL.
//
//   search  : 300/60s — workflows call this on every inbound message, often
//             several times per conversation, so it needs headroom.
//   writes  :  60/60s — creating clients/deals/tasks/quotes is materially
//             heavier (DB writes + event emission) and a compromised key
//             doing 1 write/sec for a minute is already 60 rows of junk.
//
// Both default to the throttle named in app.module.ts when not overridden on
// the method, so any future default tightening still applies to uncovered
// methods.
const SEARCH_THROTTLE = { search: { limit: 300, ttl: 60_000 } };
const WRITES_THROTTLE = { writes: { limit: 60, ttl: 60_000 } };

@Controller('agent-actions')
@UseGuards(AgentApiKeyGuard)
// Class-level fallback so any future endpoint added without an explicit
// @Throttle still gets the conservative write budget instead of inheriting
// the global 120/min default.
@Throttle(WRITES_THROTTLE)
export class AgentActionsController {
  constructor(private prisma: PrismaService) {}

  @Post('clients')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(WRITES_THROTTLE)
  async createClient(
    @Req() req: any,
    @Body(new ZodPipe(agentCreateClientSchema))
    body: {
      companyName: string;
      contactName?: string;
      email?: string;
      phone?: string;
      address?: string;
      tags?: string[];
      source?: string;
      notes?: string;
    },
  ) {
    const orgId = req.organizationId;

    const client = await this.prisma.client.create({
      data: {
        companyName: body.companyName,
        contactName: body.contactName || '',
        email: body.email || '',
        phone: body.phone || '',
        address: body.address || '',
        tags: body.tags || [],
        notes: body.notes || '',
        organizationId: orgId,
      },
    });

    return { success: true, client };
  }

  @Get('clients/search')
  // Search is read-only and called on every inbound WhatsApp message, so it
  // gets its own, much larger bucket. Even a busy org with multiple parallel
  // WhatsApp conversations rarely exceeds ~100 searches/min, 300 leaves
  // comfortable headroom while still stopping a forgetful loop from punching
  // the DB at thousands of QPS.
  @Throttle(SEARCH_THROTTLE)
  async searchClient(
    @Req() req: any,
    @Query(new ZodPipe(agentSearchClientQuerySchema))
    query: {
      phone?: string;
      email?: string;
    },
  ) {
    const orgId = req.organizationId;

    const where: any = { organizationId: orgId };
    const or: any[] = [];

    if (query.phone) or.push({ phone: query.phone });
    if (query.email) or.push({ email: query.email });

    if (or.length === 1) {
      Object.assign(where, or[0]);
    } else {
      where.OR = or;
    }

    const client = await this.prisma.client.findFirst({ where });

    return { success: true, client: client || null };
  }

  @Post('deals')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(WRITES_THROTTLE)
  async createDeal(
    @Req() req: any,
    @Body(new ZodPipe(agentCreateDealSchema))
    body: {
      title: string;
      value?: number;
      currency?: string;
      stageId?: string;
      clientId?: string;
      assignedTo?: string;
      probability?: number;
      notes?: string;
    },
  ) {
    const orgId = req.organizationId;

    let stageId = body.stageId;
    if (!stageId) {
      const firstStage = await this.prisma.pipelineStage.findFirst({
        where: { organizationId: orgId },
        orderBy: { position: 'asc' },
      });
      if (!firstStage) {
        throw new BadRequestException('No pipeline stages configured');
      }
      stageId = firstStage.id;
    }

    const deal = await this.prisma.deal.create({
      data: {
        title: body.title,
        value: body.value || 0,
        currency: body.currency || 'USD',
        stageId,
        clientId: body.clientId || null,
        assignedTo: body.assignedTo || null,
        probability: body.probability || 10,
        notes: body.notes || '',
        organizationId: orgId,
      },
    });

    return { success: true, deal };
  }

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(WRITES_THROTTLE)
  async createTask(
    @Req() req: any,
    @Body(new ZodPipe(agentCreateTaskSchema))
    body: {
      title: string;
      description?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
      dueDate?: string;
      clientId?: string;
      dealId?: string;
      assignedTo?: string;
    },
  ) {
    const orgId = req.organizationId;

    const task = await this.prisma.task.create({
      data: {
        title: body.title,
        description: body.description || '',
        priority: body.priority || 'MEDIUM',
        status: 'PENDING',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        clientId: body.clientId || null,
        dealId: body.dealId || null,
        assignedTo: body.assignedTo || null,
        createdById: body.assignedTo || null,
        organizationId: orgId,
      },
    });

    return { success: true, task };
  }

  @Post('quotes')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(WRITES_THROTTLE)
  async createQuote(
    @Req() req: any,
    @Body(new ZodPipe(agentCreateQuoteSchema))
    body: {
      title: string;
      clientId: string;
      dealId?: string;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>;
      taxRate?: number;
      notes?: string;
      terms?: string;
      validUntil?: string;
    },
  ) {
    const orgId = req.organizationId;

    const subtotal = body.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const taxRate = body.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const countResult = await this.prisma.$queryRaw<
      { nextval: number }[]
    >`SELECT nextval('quote_number_seq') as nextval`;
    const seqNumber = countResult[0]?.nextval || 1;
    const number = `COT-${String(seqNumber).padStart(5, '0')}`;

    const quote = await this.prisma.quote.create({
      data: {
        number,
        title: body.title,
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes: body.notes || '',
        terms: body.terms || '',
        validUntil: body.validUntil
          ? new Date(body.validUntil)
          : new Date(Date.now() + 30 * 86400000),
        clientId: body.clientId,
        dealId: body.dealId || null,
        createdById: null,
        organizationId: orgId,
        items: {
          create: body.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    return { success: true, quote };
  }
}
