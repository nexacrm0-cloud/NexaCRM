import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from './domain-event.interface';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  emit(event: DomainEvent): void {
    try {
      this.logger.debug(`Emitting event: ${event.eventName} (${event.aggregateId})`);
      this.emitter.emit(event.eventName, event);
    } catch (error: unknown) {
      this.logger.error(
        `Event handler failed for ${event.eventName} (aggregate: ${event.aggregateId})`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  on(eventName: string, handler: (event: DomainEvent) => void | Promise<void>): void {
    this.emitter.on(eventName, handler);
  }

  off(eventName: string, handler: (event: DomainEvent) => void | Promise<void>): void {
    this.emitter.off(eventName, handler);
  }
}
