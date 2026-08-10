import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeysService } from './api-keys.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole, createApiKeySchema, idParamSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.apiKeysService.findAll(user.organizationId);
    return { success: true, data };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async create(
    @Body(new ZodPipe(createApiKeySchema)) body: { name: string; expiresInDays?: number },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.apiKeysService.create(
      user.organizationId,
      body.name,
      user.id,
      body.expiresInDays,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.apiKeysService.remove(params.id, user.organizationId);
    return { success: true, data: { message: 'API Key eliminada' } };
  }
}
