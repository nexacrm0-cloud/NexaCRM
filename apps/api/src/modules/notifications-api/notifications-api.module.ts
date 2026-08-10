import { Module } from '@nestjs/common';
import { NotificationsApiController } from './notifications-api.controller';
import { NotificationsApiService } from './notifications-api.service';

@Module({
  controllers: [NotificationsApiController],
  providers: [NotificationsApiService],
  exports: [NotificationsApiService],
})
export class NotificationsApiModule {}
