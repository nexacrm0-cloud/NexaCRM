import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole, updateSettingsSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getSettings(user.organizationId);
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(updateSettingsSchema)) body: Record<string, unknown>,
  ) {
    return this.settingsService.updateSettings(user.organizationId, body);
  }
}
