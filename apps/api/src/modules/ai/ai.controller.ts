import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { aiQuerySchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiContextBuilder: AiContextBuilderService,
  ) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  // SECURITY: each call is an OpenAI roundtrip + DB aggregations. 30/min was
  // too permissive for the per-user cost — an authenticated user could burn
  // through the OpenAI quota (and our bill) in a few minutes. Lowered to 10
  // for the default key + the AI-specific tighter bucket via the named
  // throttler (search bucket) which limits aggregate AI traffic across
  // multiple endpoints.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async query(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(aiQuerySchema)) body: { query: string },
  ) {
    return this.aiService.processQuery(body.query, user);
  }

  @Post('command')
  @HttpCode(HttpStatus.OK)
  // Each command is potentially a mutation (create client, update deal, etc.)
  // backed by an LLM tool call. Keep this tighter than /query because
  // mutations amplify any abuse vector.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async command(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(aiQuerySchema)) body: { query: string },
  ) {
    return this.aiService.processCommand(body.query, user);
  }

  @Get('summary')
  // SECURITY: was missing a per-endpoint throttle. /ai/summary calls
  // OpenAI + assembles a multi-section CRM digest. Cap at 5/min/user to
  // prevent cache-busting abuse that defeats any upstream caching layer.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.generateSummary(user);
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async analyze(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.processAnalyze(user);
  }

  @Post('context')
  @HttpCode(HttpStatus.OK)
  // /ai/context is read-heavy but still hits OpenAI for embeddings on the
  // first call of a session. 20/min strikes a balance between UX and cost.
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async context(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(aiQuerySchema)) body: { query: string },
  ) {
    return this.aiContextBuilder.buildContext(body.query, user);
  }

  @Get('alerts')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async alerts(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.getProactiveAlerts(user);
  }
}
