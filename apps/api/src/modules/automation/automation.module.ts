import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowExecutor } from './workflow-executor.service';
import {
  WorkflowTemplatesController,
  WorkflowTemplatesAdminController,
  WorkflowPublicController,
} from './workflow-templates.controller';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { WorkflowTransferService } from './workflow-transfer.service';
import { AutomationVendorController } from './automation-vendor.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [NotificationsModule, BillingModule],
  controllers: [
    WorkflowController,
    WorkflowTemplatesController,
    WorkflowTemplatesAdminController,
    WorkflowPublicController,
    AutomationVendorController,
  ],
  providers: [WorkflowService, WorkflowExecutor, WorkflowTemplatesService, WorkflowTransferService],
  exports: [WorkflowExecutor, WorkflowTemplatesService, WorkflowTransferService],
})
export class AutomationModule {}
