import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import {
  UserRole,
  stockMovementQuerySchema,
  recordStockMovementSchema,
  idParamSchema,
} from '@nexa/shared';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VIEWER, UserRole.MEMBER, UserRole.ADMIN, UserRole.OWNER)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('movements')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listAllMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodPipe(stockMovementQuerySchema))
    query: {
      page: number;
      limit: number;
      productId?: string;
      type?: 'IN' | 'OUT' | 'ADJUST';
    },
  ) {
    return this.stockService.listAllMovements(user.organizationId, query);
  }

  @Get('products/:id/movements')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Query(new ZodPipe(stockMovementQuerySchema.pick({ page: true, limit: true })))
    query: {
      page: number;
      limit: number;
    },
  ) {
    return this.stockService.listMovements(user.organizationId, params.id, query);
  }

  @Post('products/:id/movements')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async recordMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodPipe(idParamSchema)) params: { id: string },
    @Body(new ZodPipe(recordStockMovementSchema))
    body: {
      type: 'IN' | 'OUT' | 'ADJUST';
      quantity: number;
      variantId?: string | null;
      reason?: string;
      reference?: string;
    },
  ) {
    return this.stockService.recordMovement(user.organizationId, params.id, body, user.id);
  }
}
