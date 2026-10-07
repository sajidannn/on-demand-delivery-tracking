import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import {
  NOTIFICATION_CLIENT_TOKEN,
  GATEWAY_CLIENT_TOKEN,
  EVENTS,
  OrderCreatedEvent,
  OrderDriverAssignedEvent,
  OrderStatusChangedEvent,
} from '@app/common';

@Injectable()
export class OrderEventsPublisher {
  private readonly logger = new Logger(OrderEventsPublisher.name);

  constructor(
    @Inject(NOTIFICATION_CLIENT_TOKEN) private readonly notifClient: ClientProxy,
    @Inject(GATEWAY_CLIENT_TOKEN) private readonly gatewayClient: ClientProxy,
  ) {}

  /** Kirim ke satu atau banyak client; tidak pernah melempar; timeout 2 detik. */
  private async publish(
    targets: ClientProxy[],
    pattern: string,
    payload: unknown,
  ): Promise<void> {
    await Promise.all(
      targets.map(async (client) => {
        try {
          await lastValueFrom(
            client.emit(pattern, payload).pipe(timeout(2000)),
            { defaultValue: undefined },
          );
        } catch (error) {
          this.logger.error(
            `Gagal publish ${pattern}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }),
    );
  }

  async created(event: OrderCreatedEvent): Promise<void> {
    await this.publish([this.notifClient], EVENTS.ORDER.CREATED, event);
  }

  async driverAssigned(event: OrderDriverAssignedEvent): Promise<void> {
    await this.publish(
      [this.notifClient, this.gatewayClient],
      EVENTS.ORDER.DRIVER_ASSIGNED,
      event,
    );
  }

  async statusChanged(event: OrderStatusChangedEvent): Promise<void> {
    await this.publish(
      [this.notifClient, this.gatewayClient],
      EVENTS.ORDER.STATUS_CHANGED,
      event,
    );
  }
}
