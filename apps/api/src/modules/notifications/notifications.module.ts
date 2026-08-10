import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ResendEmailProvider } from './resend.provider';
import { LogEmailProvider } from './log.provider';

@Module({
  providers: [
    NotificationsService,
    ResendEmailProvider,
    LogEmailProvider,
    {
      provide: 'EMAIL_PROVIDER',
      useFactory: (resend: ResendEmailProvider, log: LogEmailProvider) => {
        return process.env.RESEND_API_KEY ? resend : log;
      },
      inject: [ResendEmailProvider, LogEmailProvider],
    },
  ],
  exports: [NotificationsService, 'EMAIL_PROVIDER'],
})
export class NotificationsModule {}
