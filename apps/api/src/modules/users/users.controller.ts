import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { updateUserSchema, updatePasswordSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { buildSelect, USER_SELECTABLE_FIELDS } from '../../common/utils/select-projection';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getProfile(@CurrentUser() user: AuthenticatedUser, @Query('select') select?: string) {
    // ?select= projection: client can request a subset of fields. Validated
    // against an allowlist; sensitive fields (passwordHash, refreshToken,
    // twoFactorSecret, etc.) are blocked both by the allowlist AND by a hard
    // denylist inside buildSelect so they cannot leak even if a future
    // service refactor asks Prisma for them. When ?select is absent we fall
    // through to the service's default select, which already excludes
    // sensitive columns.
    const prismaSelect = buildSelect(select, USER_SELECTABLE_FIELDS);
    return this.usersService.getProfile(user.id, prismaSelect);
  }

  @Patch('me')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(updateUserSchema)) body: unknown,
  ) {
    return this.usersService.updateProfile(user.id, body as any);
  }

  @Patch('me/password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async updatePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(updatePasswordSchema)) body: unknown,
  ) {
    const data = body as any;
    await this.usersService.updatePassword(user.id, data.currentPassword, data.newPassword);
    return { success: true, message: 'Contraseña actualizada exitosamente' };
  }
}
