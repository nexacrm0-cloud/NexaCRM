import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getSummary(user.organizationId);
  }

  @Get('sales-trend')
  async getSalesTrend(@CurrentUser() user: AuthenticatedUser) {
    return await this.dashboardService.getSalesTrend(user.organizationId);
  }

  @Get('recent-activity')
  async getRecentActivity(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getRecentActivity(user.organizationId);
  }
}
