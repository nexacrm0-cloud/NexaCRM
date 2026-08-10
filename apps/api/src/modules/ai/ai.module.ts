import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { AiContextBuilderService } from './ai-context-builder.service';
import { IntentDetectionModule } from '../../intent-detection/intent-detection.module';

@Module({
  imports: [IntentDetectionModule],
  controllers: [AiController],
  providers: [AiService, AiToolsService, AiContextBuilderService],
  exports: [AiService, AiContextBuilderService],
})
export class AiModule {}
