import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EVENTS } from '@app/common';
import type {
  OrderCreatedEvent,
  OrderDriverAssignedEvent,
  OrderStatusChangedEvent,
} from '@app/common';
import { NotificationServiceService } from './notification-service.service.js';

@Controller()
export class NotificationServiceController {
  private readonly logger = new Logger(NotificationServiceController.name);

  constructor(private readonly svc: NotificationServiceService) {}

  @EventPattern<string>(EVENTS.ORDER.CREATED)
  handleOrderCreated(@Payload() data: OrderCreatedEvent) {
    for (const msg of this.svc.buildCreatedMessages(data)) {
      this.logger.log(JSON.stringify(msg));
    }
  }

  @EventPattern<string>(EVENTS.ORDER.DRIVER_ASSIGNED)
  handleDriverAssigned(@Payload() data: OrderDriverAssignedEvent) {
    for (const msg of this.svc.buildDriverAssignedMessages(data)) {
      this.logger.log(JSON.stringify(msg));
    }
  }

  @EventPattern<string>(EVENTS.ORDER.STATUS_CHANGED)
  handleStatusChanged(@Payload() data: OrderStatusChangedEvent) {
    for (const msg of this.svc.buildStatusChangedMessages(data)) {
      this.logger.log(JSON.stringify(msg));
    }
  }
}
