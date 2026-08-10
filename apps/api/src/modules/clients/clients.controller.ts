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
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole } from '@nexa/shared';
import { createClientSchema, updateClientSchema } from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { buildSelect, CLIENT_SELECTABLE_FIELDS } from '../../common/utils/select-projection';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('select') select?: string,
  ) {
    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1) throw new BadRequestException('Limit must be > 0');
    return this.clientsService.findAll(user.organizationId, {
      page,
      limit,
      search,
      prismaSelect: buildSelect(select, CLIENT_SELECTABLE_FIELDS),
    });
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.findOne(id, user.organizationId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(createClientSchema)) body: unknown,
  ) {
    const data = body as any;
    return this.clientsService.create(user.organizationId, data, user.id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateClientSchema)) body: unknown,
  ) {
    return this.clientsService.update(id, user.organizationId, body as any, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.clientsService.remove(id, user.organizationId, user.id);
    return { success: true, message: 'Cliente eliminado exitosamente' };
  }
}
