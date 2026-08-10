import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventsService } from './events.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { createEventSchema, updateEventSchema, UserRole } from '@nexa/shared';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.eventsService.findAll(user.organizationId, { page, limit, startDate, endDate });
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventsService.findOne(id, user.organizationId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createEventSchema)) body: unknown,
  ) {
    return this.eventsService.create(user.organizationId, body as any, user.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateEventSchema)) body: unknown,
  ) {
    return this.eventsService.update(id, user.organizationId, body as any, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.eventsService.remove(id, user.organizationId, user.id);
  }
}
