import { Injectable } from '@nestjs/common';
import {
  OrderCreatedEvent,
  OrderDriverAssignedEvent,
  OrderStatusChangedEvent,
} from '@app/common';

export interface NotificationLog {
  event: string;
  orderId: string;
  recipient: string;
  message: string;
}

@Injectable()
export class NotificationServiceService {
  buildCreatedMessages(data: OrderCreatedEvent): NotificationLog[] {
    return [{
      event: 'order.created',
      orderId: data.orderId,
      recipient: data.customerId,
      message: `Order ${data.orderId} berhasil dibuat.`,
    }];
  }

  buildDriverAssignedMessages(data: OrderDriverAssignedEvent): NotificationLog[] {
    return [
      {
        event: 'order.driver_assigned',
        orderId: data.orderId,
        recipient: data.customerId,
        message: `Driver ditemukan untuk order ${data.orderId}.`,
      },
      {
        event: 'order.driver_assigned',
        orderId: data.orderId,
        recipient: data.driverId,
        message: `Kamu mendapat order ${data.orderId}.`,
      },
    ];
  }

  buildStatusChangedMessages(data: OrderStatusChangedEvent): NotificationLog[] {
    return [{
      event: 'order.status_changed',
      orderId: data.orderId,
      recipient: data.customerId,
      message: `Status order ${data.orderId} berubah menjadi ${data.status}.`,
    }];
  }
}
