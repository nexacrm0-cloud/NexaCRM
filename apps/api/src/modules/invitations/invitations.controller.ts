import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole } from '@nexa/shared';
import { createInvitationSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async create(
    @Body(new ZodPipe(createInvitationSchema)) body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = body as { email: string; role: string };
    const result = await this.invitationsService.create(
      data,
      user.organizationId,
      user.id,
      user.role,
    );
    return { success: true, data: result };
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.invitationsService.findAll(user.organizationId);
    return { success: true, data: result };
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.invitationsService.remove(id, user.organizationId);
    return { success: true, data: { message: 'Invitación revocada' } };
  }
}
