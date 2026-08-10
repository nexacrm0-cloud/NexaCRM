import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, idParamSchema } from '@nexa/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@nexa/database';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getAvailableAgents(@CurrentUser() user: User) {
    return this.agentsService.getAvailableAgents(user.organizationId);
  }

  @Post(':id/activate')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async activate(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.agentsService.activateAgent(user.organizationId, params.id);
  }

  @Delete(':id/deactivate')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async deactivate(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.agentsService.deactivateAgent(user.organizationId, params.id);
  }

  @Get(':id/metrics')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getMetrics(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.agentsService.getAgentMetrics(user.organizationId, params.id);
  }

  @Get(':id/logs')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getLogs(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.agentsService.getExecutionLogs(user.organizationId, params.id);
  }

  @Get(':id/api-key')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async getApiKey(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.agentsService.getAgentApiKey(user.organizationId, params.id);
  }

  @Post(':id/api-key/regenerate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async regenerateApiKey(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.agentsService.regenerateAgentApiKey(user.organizationId, params.id, user.id);
  }
}
