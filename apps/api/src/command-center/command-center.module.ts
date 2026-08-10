import { Module } from '@nestjs/common';
import { CommandCenterController } from './command-center.controller';
import { CommandCenterService } from './command-center.service';
import { IntentDetectionModule } from '../intent-detection/intent-detection.module';

@Module({
  imports: [IntentDetectionModule],
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
  exports: [CommandCenterService],
})
export class CommandCenterModule {}
