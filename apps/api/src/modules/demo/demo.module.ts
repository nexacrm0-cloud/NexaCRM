import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DemoService } from './demo.service';
import { DemoExpiryService } from './demo-expiry.service';
import { DemoAccessService } from './demo-access.service';
import { DemoAccessController } from './demo-access.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule is needed by DemoAccessService: the one-click demo link issues
  // a real session through AuthService.issueSession (so the refresh-token
  // rotation is registered and the session survives a page reload).
  imports: [JwtModule.register({}), AuthModule],
  controllers: [DemoAccessController],
  providers: [DemoService, DemoExpiryService, DemoAccessService],
  exports: [DemoService, DemoAccessService],
})
export class DemoModule {}
