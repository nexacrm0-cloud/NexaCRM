import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../event-bus/event-bus.service';
import { createToolDefinitions } from './tools';

@Injectable()
export class ToolRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistrationService.name);

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    const definitions = createToolDefinitions(this.prisma, this.eventBus);
    for (const tool of definitions) {
      this.toolRegistry.register(tool);
    }
    this.logger.log(`Registered ${definitions.length} tools`);
  }
}
