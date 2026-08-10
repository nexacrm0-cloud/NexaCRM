import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PipelineService } from './pipeline.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole } from '@nexa/shared';
import { createDealSchema, updateDealSchema, moveDealSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('pipeline')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('funnel')
  async getFunnel(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.pipelineService.getFunnel(user.organizationId) };
  }

  @Get('forecast')
  async getForecast(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.pipelineService.getForecast(user.organizationId),
    };
  }

  @Get('stages')
  async getStages(@CurrentUser() user: AuthenticatedUser) {
    return this.pipelineService.getStages(user.organizationId);
  }

  @Get('health')
  async getHealth(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.pipelineService.getHealth(user.organizationId),
    };
  }

  @Get('deals')
  async getDeals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('stageId') stageId?: string,
    @Query('search') search?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('clientId') clientId?: string,
    @Query('minValue') minValue?: string,
    @Query('maxValue') maxValue?: string,
    @Query('closeDateFrom') closeDateFrom?: string,
    @Query('closeDateTo') closeDateTo?: string,
  ) {
    return this.pipelineService.getDeals(user.organizationId, {
      stageId,
      search,
      assignedTo,
      clientId,
      minValue: minValue !== undefined ? Number(minValue) : undefined,
      maxValue: maxValue !== undefined ? Number(maxValue) : undefined,
      closeDateFrom,
      closeDateTo,
    });
  }

  @Patch('deals/bulk-move')
  async bulkMove(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { ids: string[]; stageId: string },
  ) {
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new BadRequestException('ids requerido');
    }
    const moved = await this.pipelineService.moveDeals(
      user.organizationId,
      body.ids,
      body.stageId,
      user.id,
    );
    return { data: moved };
  }

  @Get('deals/:id')
  async getDeal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.pipelineService.getDeal(id, user.organizationId);
  }

  @Post('deals')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async createDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createDealSchema)) body: unknown,
  ) {
    const data = body as any;
    return this.pipelineService.createDeal(user.organizationId, data, user.id);
  }

  @Patch('deals/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateDealSchema)) body: unknown,
  ) {
    return this.pipelineService.updateDeal(id, user.organizationId, body as any, user.id);
  }

  @Patch('deals/:id/move')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async moveDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(moveDealSchema)) body: unknown,
  ) {
    const data = body as any;
    return this.pipelineService.moveDeal(id, user.organizationId, data.stageId, user.id);
  }

  @Delete('deals/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async removeDeal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.pipelineService.removeDeal(id, user.organizationId, user.id);
    return { success: true, message: 'Oportunidad eliminada exitosamente' };
  }
}
