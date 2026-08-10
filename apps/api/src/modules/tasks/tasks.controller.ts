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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole } from '@nexa/shared';
import { createTaskSchema, updateTaskSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1) throw new BadRequestException('Limit must be > 0');
    return this.tasksService.findAll(user.organizationId, {
      status,
      priority,
      assignedTo,
      page,
      limit,
    });
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasksService.findOne(id, user.organizationId);
  }

  @Post()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createTaskSchema)) body: unknown,
  ) {
    const data = body as any;
    return this.tasksService.create(user.organizationId, data, user.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateTaskSchema)) body: unknown,
  ) {
    return this.tasksService.update(id, user.organizationId, body as any, user.id);
  }

  @Patch(':id/complete')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tasksService.complete(id, user.organizationId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.tasksService.remove(id, user.organizationId, user.id);
    return { success: true, message: 'Tarea eliminada exitosamente' };
  }
}
