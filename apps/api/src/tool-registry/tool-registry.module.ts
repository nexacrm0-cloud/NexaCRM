import { Global, Module } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import { ToolRegistrationService } from './tool-registration.service';
import { PrismaModule } from '../config/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ToolRegistryService, ToolRegistrationService],
  exports: [ToolRegistryService],
})
export class ToolRegistryModule {}
