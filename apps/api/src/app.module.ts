import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { UserOrIpThrottlerGuard } from './common/guards/user-throttler.guard';
import { RlsCleanupInterceptor } from './common/interceptors/rls-cleanup.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationsApiModule } from './modules/notifications-api/notifications-api.module';
import { SettingsModule } from './modules/settings/settings.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { SearchModule } from './modules/search/search.module';
import { ActivityModule } from './modules/activity/activity.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { EventsModule } from './modules/events/events.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PrismaModule } from './config/prisma.module';
import { EventBusModule } from './event-bus/event-bus.module';
import { ToolRegistryModule } from './tool-registry/tool-registry.module';
import { CommandCenterModule } from './command-center/command-center.module';
import { IntentDetectionModule } from './intent-detection/intent-detection.module';
import { SupportModule } from './modules/support/support.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AgentsModule } from './modules/agents/agents.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { InternalModule } from './modules/internal/internal.module';
import { HealthModule } from './modules/health/health.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

@Module({
  imports: [
    // Redis-backed throttler storage so rate limits are shared across all API
    // replicas. Without this, a horizontally-scaled deployment gets N
    // independent in-memory counters (one per process), and a client
    // round-robining between replicas gets Nx the configured limit — i.e.
    // the rate limit silently doesn't work.
    //
    // When REDIS_URL is unset (local dev, jest e2e) we pass `storage:
    // undefined`, which makes @nestjs/throttler fall back to its built-in
    // in-memory storage — preserving the existing single-process behavior.
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL;
        const throttlers = [
          {
            name: 'default',
            ttl: 60_000,
            limit: process.env.NODE_ENV === 'production' ? 120 : 600,
          },
          {
            // Read-heavy bucket for agent-actions/clients/search. Higher
            // limit because the inbound WhatsApp workflow calls it on
            // every message.
            name: 'search',
            ttl: 60_000,
            limit: 300,
          },
          {
            // Write bucket for create-* agent-actions. Tighter because
            // each request is an INSERT + a domain event.
            name: 'writes',
            ttl: 60_000,
            limit: 60,
          },
          {
            // Agent callback (read-ish): n8n pings us with execution
            // results at higher cadence than user-triggered writes.
            name: 'agent-callback',
            ttl: 60_000,
            limit: 120,
          },
          {
            // Agent trigger (write): INSERTs an AgentExecution + POSTs to
            // n8n, so it's more expensive than a callback. Tighter limit
            // to bound the blast radius of a leaked INTERNAL_API_KEY.
            name: 'agent-trigger',
            ttl: 60_000,
            limit: 60,
          },
        ];
        if (!redisUrl) {
          return { throttlers };
        }
        // keyPrefix namespaces throttler keys inside the shared Redis so they
        // don't collide with other consumers (BullMQ, n8n, etc.). We disable
        // the offline queue so an unreachable Redis fails fast instead of
        // buffering requests inside the process and masking a Redis outage.
        const storage = new ThrottlerStorageRedisService(redisUrl, {
          keyPrefix: 'nexa:throttler:',
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
          lazyConnect: false,
          retryStrategy: (times: number) => Math.min(times * 100, 2000),
        } as any);
        return { throttlers, storage };
      },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventBusModule,
    ToolRegistryModule,
    CommandCenterModule,
    IntentDetectionModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    PipelineModule,
    TasksModule,
    QuotesModule,
    DashboardModule,
    AiModule,
    NotificationsModule,
    NotificationsApiModule,
    SettingsModule,
    OrganizationsModule,
    InvitationsModule,
    ApiKeysModule,
    ActivityModule,
    SearchModule,
    UploadsModule,
    EventsModule,
    InvoicesModule,
    AutomationModule,
    SupportModule,
    ConnectorsModule,
    AgentsModule,
    SubscriptionsModule,
    WhatsAppModule,
    InternalModule,
    InventoryModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserOrIpThrottlerGuard,
    },
    {
      // RLS cleanup interceptor: runs AFTER the response stream completes
      // (finalize semantics) and RESETs the Postgres session role + the
      // app.organization_id session var set by TenantMiddleware, so the
      // pooled connection returns to the pool without leftover tenant
      // state. Registered before the LoggingInterceptor so the log entry
      // is written first and the reset runs after — both observable as
      // ordered side-effects.
      provide: APP_INTERCEPTOR,
      useClass: RlsCleanupInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // CSRF must run AFTER cookieParser (mounted in main.ts) and BEFORE guards,
    // so apply it only to the API prefix. It skips its own EXCLUDED_PATHS for
    // unauthenticated flows (login, register, webhooks, etc.).
    consumer.apply(CsrfMiddleware).forRoutes({ path: 'api/v1/*', method: 'ALL' as any });
    consumer
      .apply(TenantMiddleware)
      .exclude({ path: 'api/v1/health', method: RequestMethod.GET })
      .forRoutes('*');
  }
}
