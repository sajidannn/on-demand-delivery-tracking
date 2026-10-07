import { Test, TestingModule } from '@nestjs/testing';
import { NotificationServiceService } from './notification-service.service.js';
import { OrderStatus } from '@app/common';

describe('NotificationServiceService', () => {
  let service: NotificationServiceService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      providers: [NotificationServiceService],
    }).compile();

    service = app.get<NotificationServiceService>(NotificationServiceService);
  });

  describe('buildCreatedMessages', () => {
    it('should return 1 message for customer', () => {
      const msgs = service.buildCreatedMessages({
        orderId: 'o1',
        customerId: 'c1',
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({
        event: 'order.created',
        orderId: 'o1',
        recipient: 'c1',
        message: 'Order o1 berhasil dibuat.',
      });
    });
  });

  describe('buildDriverAssignedMessages', () => {
    it('should return 2 messages for customer and driver', () => {
      const msgs = service.buildDriverAssignedMessages({
        orderId: 'o1',
        customerId: 'c1',
        driverId: 'd1',
      });
      expect(msgs).toHaveLength(2);
      expect(msgs[0]).toMatchObject({
        event: 'order.driver_assigned',
        orderId: 'o1',
        recipient: 'c1',
        message: 'Driver ditemukan untuk order o1.',
      });
      expect(msgs[1]).toMatchObject({
        event: 'order.driver_assigned',
        orderId: 'o1',
        recipient: 'd1',
        message: 'Kamu mendapat order o1.',
      });
    });
  });

  describe('buildStatusChangedMessages', () => {
    it('should return 1 message for customer with correct status', () => {
      const msgs = service.buildStatusChangedMessages({
        orderId: 'o1',
        customerId: 'c1',
        status: OrderStatus.COMPLETED,
      });
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toMatchObject({
        event: 'order.status_changed',
        orderId: 'o1',
        recipient: 'c1',
        message: 'Status order o1 berubah menjadi COMPLETED.',
      });
    });
  });
});
