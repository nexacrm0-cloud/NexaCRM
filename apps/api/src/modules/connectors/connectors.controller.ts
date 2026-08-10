import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConnectorsService } from './connectors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, ConnectorType, upsertConnectorSchema, idParamSchema } from '@nexa/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@nexa/database';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ConnectorConfig } from './connectors.service';

@Controller('connectors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConnectorsController {
  constructor(private connectorsService: ConnectorsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getMyConnectors(@CurrentUser() user: User) {
    return this.connectorsService.getConnectors(user.organizationId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async upsertConnector(
    @CurrentUser() user: User,
    @Body(new ZodPipe(upsertConnectorSchema))
    data: { type: ConnectorType; config: ConnectorConfig },
  ) {
    return this.connectorsService.upsertConnector(user.organizationId, user.id, {
      name: data.type,
      type: data.type,
      config: data.config,
    });
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(
    @CurrentUser() user: User,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
  ) {
    return this.connectorsService.deleteConnector(params.id, user.organizationId);
  }
}
