import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { InternalService } from './internal.service';
import { organizationIdParamSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('internal')
@UseGuards(InternalApiKeyGuard)
@Throttle({ default: { limit: 300, ttl: 60_000 } })
export class InternalController {
  constructor(private internalService: InternalService) {}

  @Get('pipeline/:organizationId')
  async getPipeline(
    @Param(new ZodPipe(organizationIdParamSchema)) params: { organizationId: string },
  ) {
    return this.internalService.getPipelineData(params.organizationId);
  }

  @Get('clients/:organizationId')
  async getClients(
    @Param(new ZodPipe(organizationIdParamSchema)) params: { organizationId: string },
  ) {
    return this.internalService.getClientData(params.organizationId);
  }

  @Get('metrics/:organizationId')
  async getMetrics(
    @Param(new ZodPipe(organizationIdParamSchema)) params: { organizationId: string },
  ) {
    return this.internalService.getMetricsData(params.organizationId);
  }

  @Get('tasks/:organizationId')
  async getTasks(
    @Param(new ZodPipe(organizationIdParamSchema)) params: { organizationId: string },
  ) {
    return this.internalService.getTasksData(params.organizationId);
  }
}
