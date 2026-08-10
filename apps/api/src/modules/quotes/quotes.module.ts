import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [QuotesController],
  providers: [QuotesService],
  imports: [NotificationsModule],
  exports: [QuotesService],
})
export class QuotesModule {}
