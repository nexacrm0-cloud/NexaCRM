import { ToolDefinition } from '../tool.interface';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

import { crudTools } from './crud-tools';
import { dashboardTools } from './dashboard-tools';
import { clientTools } from './client-tools';
import { aiTools } from './ai-tools';
import { inventoryTools } from './inventory-tools';

export function createToolDefinitions(
  prisma: PrismaService,
  eventBus: EventBusService,
): ToolDefinition[] {
  const factories = [
    ...crudTools,
    ...dashboardTools,
    ...clientTools,
    ...aiTools,
    ...inventoryTools,
  ];
  return factories.map((factory) => factory(prisma, eventBus));
}

export { createToolDefinitions as createAllDefinitions };
