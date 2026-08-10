import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import {
  ActivityHandler,
  AuditHandler,
  SearchIndexHandler,
  DashboardHandler,
  WorkflowHandler,
  NotificationHandler,
  AgentEventHandler,
  InvoiceEmailHandler,
} from './handlers';
import { AgentsModule } from '../modules/agents/agents.module';
import { InvoicesModule } from '../modules/invoices/invoices.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { AutomationModule } from '../modules/automation/automation.module';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    AgentsModule,
    InvoicesModule,
    NotificationsModule,
    AutomationModule,
  ],
  providers: [
    EventBusService,
    ActivityHandler,
    AuditHandler,
    SearchIndexHandler,
    DashboardHandler,
    WorkflowHandler,
    NotificationHandler,
    AgentEventHandler,
    InvoiceEmailHandler,
  ],
  exports: [EventBusService],
})
export class EventBusModule {}
