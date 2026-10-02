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
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkflowService } from './workflow.service';
import { WorkflowTransferService } from './workflow-transfer.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkflowsEnabledGuard } from '../../common/guards/workflows-enabled.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nexa/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@nexa/database';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { createWorkflowSchema, updateWorkflowSchema, transferSchema } from './workflow.schemas';

@Controller('automation/workflows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkflowController {
  constructor(
    private workflowService: WorkflowService,
    private transferService: WorkflowTransferService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async findAll(
    @CurrentUser() user: User,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.workflowService.findAll(user.organizationId);
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.workflowService.findOne(id, user.organizationId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(WorkflowsEnabledGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async create(@CurrentUser() user: User, @Body(new ZodPipe(createWorkflowSchema)) data: unknown) {
    return this.workflowService.create(user.organizationId, user.id, data);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(WorkflowsEnabledGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodPipe(updateWorkflowSchema)) data: unknown,
  ) {
    return this.workflowService.update(id, user.organizationId, data);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.workflowService.delete(id, user.organizationId);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(WorkflowsEnabledGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async toggle(@CurrentUser() user: User, @Param('id') id: string) {
    return this.workflowService.toggleActive(id, user.organizationId);
  }

  @Post(':id/transfer')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @UseGuards(WorkflowsEnabledGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async transfer(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body(new ZodPipe(transferSchema)) body: unknown,
  ) {
    const data = body as { targetEmail: string };
    return this.transferService.transferToClient(user.organizationId, {
      workflowId: id,
      targetEmail: data.targetEmail,
    });
  }

  @Get('logs')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getLogs(
    @CurrentUser() user: User,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.workflowService.getExecutionLogs(
      user.organizationId,
      parseInt(limit),
      parseInt(page),
    );
  }
}
