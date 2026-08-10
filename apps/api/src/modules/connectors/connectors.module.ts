import { Module } from '@nestjs/common';
import { ConnectorsService } from './connectors.service';
import { ConnectorsController } from './connectors.controller';
import { PrismaService } from '@nexa/database';

@Module({
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {
  constructor(private prisma: PrismaService) {}
}
