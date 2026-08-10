import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, changePlanSchema, PlanTier } from '@nexa/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@nexa/database';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getPlans() {
    return this.subscriptionsService.getAvailablePlans();
  }

  @Get('current')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getCurrentPlan(@CurrentUser() user: User) {
    return this.subscriptionsService.getCurrentPlan(user.organizationId);
  }

  @Post('change')
  @Roles(UserRole.OWNER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePlan(
    @CurrentUser() user: User,
    @Body(new ZodPipe(changePlanSchema)) body: { plan: PlanTier },
  ) {
    return this.subscriptionsService.changePlan(user.organizationId, body.plan);
  }

  @Post('cancel')
  @Roles(UserRole.OWNER)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async cancelPlan(@CurrentUser() user: User) {
    return this.subscriptionsService.cancelPlan(user.organizationId);
  }
}
