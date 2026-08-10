import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AgentsService } from './agents.service';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { agentCallbackSchema, agentTriggerSchema } from '@nexa/shared';

@Controller('webhooks/agents')
export class AgentWebhookController {
  private readonly logger = new Logger(AgentWebhookController.name);

  constructor(private agentsService: AgentsService) {}

  @Post('callback')
  @UseGuards(InternalApiKeyGuard)
  // Dedicated 'agent-callback' bucket so callback traffic (high-frequency,
  // read-mostly updates to execution rows) doesn't share the budget with
  // the heavier 'agent-trigger' writes.
  @Throttle({ 'agent-callback': { limit: 120, ttl: 60_000 } })
  async handleCallback(
    @Body(new ZodPipe(agentCallbackSchema))
    body: {
      executionId: string;
      agentId: string;
      organizationId: string;
      status: 'COMPLETED' | 'FAILED';
      output?: Record<string, any>;
      error?: string;
      durationMs?: number;
    },
  ) {
    this.logger.log(`Agent webhook callback: ${body.agentId} - ${body.status}`);

    try {
      return await this.agentsService.reportExecution(
        body.executionId,
        body.organizationId,
        body.agentId,
        {
          status: body.status,
          output: body.output,
          error: body.error,
          durationMs: body.durationMs,
        },
      );
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
      if ((err as any)?.code === 'P2025') {
        throw new NotFoundException('Execution not found');
      }
      throw err;
    }
  }

  @Post('trigger')
  @UseGuards(InternalApiKeyGuard)
  // Separate 'agent-trigger' bucket: each trigger INSERTs an AgentExecution
  // AND fires an HTTP POST to n8n, so it's materially more expensive than a
  // callback. Tighter limit than callback to bound the blast radius of a
  // leaked INTERNAL_API_KEY.
  @Throttle({ 'agent-trigger': { limit: 60, ttl: 60_000 } })
  async handleTrigger(
    @Body(new ZodPipe(agentTriggerSchema))
    body: {
      agentId: string;
      organizationId: string;
      event: string;
      payload: Record<string, any>;
    },
  ) {
    this.logger.log(`Agent webhook trigger: ${body.agentId} - event: ${body.event}`);

    // SECURITY CR3: validate that the agent is actually subscribed to the
    // target organization before creating an execution and firing the
    // external webhook. This prevents a leaked INTERNAL_API_KEY from
    // spamming executions on arbitrary orgs or impersonating others.
    const agent = await this.agentsService.getAgentById(body.agentId);
    if (!agent?.webhookUrl) {
      throw new BadRequestException('Agent not found or no webhookUrl configured');
    }

    const sub = await this.agentsService.getActiveSubscription(body.organizationId, body.agentId);
    if (!sub) {
      throw new ForbiddenException('Agent is not subscribed to the target organization');
    }

    const result = await this.agentsService.dispatchToAgent({
      agentId: body.agentId,
      organizationId: body.organizationId,
      event: body.event,
      payload: body.payload,
      webhookUrl: agent.webhookUrl,
    });

    return { executionId: result.executionId, status: result.status };
  }
}
