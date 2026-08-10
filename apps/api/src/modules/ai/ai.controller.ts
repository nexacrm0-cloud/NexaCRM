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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async query(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(aiQuerySchema)) body: { query: string },
  ) {
    return this.aiService.processQuery(body.query, user);
  }

  @Post('command')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async command(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(aiQuerySchema)) body: { query: string },
  ) {
    return this.aiService.processCommand(body.query, user);
  }

  @Get('summary')
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
