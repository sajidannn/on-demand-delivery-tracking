import { Controller, Get, Logger } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EVENTS, OrderStatus } from '@app/common';
import type {
  OrderDriverAssignedEvent,
  OrderStatusChangedEvent,
} from '@app/common';
import { TrackingGateway } from './tracking.gateway.js';

@ApiExcludeController()
@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(private readonly trackingGateway: TrackingGateway) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @EventPattern<string>(EVENTS.ORDER.DRIVER_ASSIGNED)
  handleDriverAssigned(@Payload() data: OrderDriverAssignedEvent) {
    this.logger.log(
      `Menerima notifikasi dari RMQ: Driver ${data.driverId} di-assign ke order ${data.orderId}`,
    );
    this.trackingGateway.broadcastOrderStatus(
      {
        orderId: data.orderId,
        status: OrderStatus.DRIVER_ASSIGNED,
        driverId: data.driverId,
      },
      data.customerId,
      data.driverId,
    );
  }

  @EventPattern<string>(EVENTS.ORDER.STATUS_CHANGED)
  handleStatusChanged(@Payload() data: OrderStatusChangedEvent) {
    this.logger.log(
      `Menerima notifikasi dari RMQ: Status order ${data.orderId} berubah jadi ${data.status}`,
    );
    this.trackingGateway.broadcastOrderStatus(
      {
        orderId: data.orderId,
        status: data.status,
        driverId: data.driverId,
      },
      data.customerId,
      data.driverId,
    );

    if (data.status === OrderStatus.COMPLETED && data.driverId) {
      this.trackingGateway.clearOrderCache(data.orderId);
    }
  }
}
