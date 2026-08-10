import { Controller, Get, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { UserRole } from '@nexa/shared';
import { InventorySearchService } from './inventory-search.service';

@Controller('inventory/search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class InventorySearchController {
  constructor(private readonly svc: InventorySearchService) {}

  @Get('products')
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    return this.svc.search(user.organizationId, q ?? '', limit);
  }
}
