import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { OrderStatus } from '@app/common';

@Injectable()
export class OrderStateMachine {
  /**
   * Memvalidasi apakah transisi status diperbolehkan.
   * Akan melempar RpcException jika transisi tidak valid.
   */
  validateTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.NO_DRIVER_AVAILABLE,
      ],
      [OrderStatus.DRIVER_ASSIGNED]: [OrderStatus.PICKED_UP],
      [OrderStatus.PICKED_UP]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.NO_DRIVER_AVAILABLE]: [],
    };

    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new RpcException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Transisi status ilegal: tidak bisa mengubah order dari ${currentStatus} ke ${newStatus}`,
      });
    }
  }
}
