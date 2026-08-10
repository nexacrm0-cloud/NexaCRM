import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { NotificationsApiService } from './notifications-api.service';
import { notificationsQuerySchema, idParamSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

interface RequestWithUser extends Request {
  user: { id: string; organizationId: string; role: string; email: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsApiController {
  constructor(private readonly service: NotificationsApiService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(
    @Req() req: RequestWithUser,
    @Query(new ZodPipe(notificationsQuerySchema)) query: { limit: number },
  ) {
    return this.service.findAll(req.user.organizationId, req.user.id, query.limit);
  }

  @Get('unread-count')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async unreadCount(@Req() req: RequestWithUser) {
    const result = await this.service.findAll(req.user.organizationId, req.user.id, 1);
    return { data: { unreadCount: result.meta.unreadCount } };
  }

  @Patch(':id/read')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async markAsRead(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Req() req: RequestWithUser,
  ) {
    await this.service.markAsRead(params.id, req.user.organizationId);
    return { success: true };
  }

  @Patch('read-all')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async markAllAsRead(@Req() req: RequestWithUser) {
    await this.service.markAllAsRead(req.user.organizationId, req.user.id);
    return { success: true };
  }
}
