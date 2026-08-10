import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@nexa/database';

@Injectable()
export class WhatsappCleanupService {
  private readonly logger = new Logger(WhatsappCleanupService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldMessages() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
      const { count } = await this.prisma.whatsappProcessedMessage.deleteMany({
        where: { processedAt: { lt: cutoff } },
      });
      this.logger.log(`Cleaned ${count} processed WhatsApp messages older than 30 days`);
    } catch (err) {
      this.logger.error('Failed to cleanup processed messages', err as Error);
    }
  }
}
