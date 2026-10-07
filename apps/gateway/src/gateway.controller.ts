import { Controller, Get, Logger } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EVENTS } from '@app/common';
import type {
  OrderDriverAssignedEvent,
  OrderStatusChangedEvent,
} from '@app/common';

/**
 * Health-check minimal. Tidak didokumentasikan di Swagger (bukan bagian PRD §5).
 * Gunakan untuk cek apakah gateway HTTP server berjalan.
 */
@ApiExcludeController()
@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @EventPattern<string>(EVENTS.ORDER.DRIVER_ASSIGNED)
  handleDriverAssigned(@Payload() data: OrderDriverAssignedEvent) {
    this.logger.log(
      `Menerima notifikasi dari RMQ: Driver ${data.driverId} di-assign ke order ${data.orderId}`,
    );
  }

  @EventPattern<string>(EVENTS.ORDER.STATUS_CHANGED)
  handleStatusChanged(@Payload() data: OrderStatusChangedEvent) {
    this.logger.log(
      `Menerima notifikasi dari RMQ: Status order ${data.orderId} berubah jadi ${data.status}`,
    );
  }
}
