import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma.module';
import { EventBusModule } from '../../event-bus/event-bus.module';
import { AgentsModule } from '../agents/agents.module';
import { HmacService } from '../../common/services/hmac.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsappCleanupService } from './whatsapp-cleanup.service';

@Module({
  imports: [PrismaModule, EventBusModule, AgentsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, WhatsappCleanupService, HmacService],
})
export class WhatsAppModule {}
