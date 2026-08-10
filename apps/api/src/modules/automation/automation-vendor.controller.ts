import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@nexa/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@nexa/database';
import { WorkflowTransferService } from './workflow-transfer.service';

@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AutomationVendorController {
  constructor(private transferService: WorkflowTransferService) {}

  @Get('transfers/recent')
  async recentTransfers(@CurrentUser() user: User) {
    return this.transferService.recentTransfers(user.organizationId);
  }

  @Get('subscriptions')
  async subscriptions(@CurrentUser() user: User) {
    return this.transferService.subscriptionsForVendor(user.organizationId);
  }
}
