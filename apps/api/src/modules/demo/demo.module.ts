import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DemoService } from './demo.service';
import { DemoExpiryService } from './demo-expiry.service';
import { DemoAccessService } from './demo-access.service';
import { DemoAccessController } from './demo-access.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DemoAccessController],
  providers: [DemoService, DemoExpiryService, DemoAccessService],
  exports: [DemoService, DemoAccessService],
})
export class DemoModule {}
