import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AUTH_SERVICE_TOKEN, OrderStatus, PATTERNS } from '@app/common';
import { NotificationServiceService } from './notification-service.service.js';
import { EmailService } from './email/email.service.js';

describe('NotificationServiceService', () => {
  let service: NotificationServiceService;
  let mockAuthClient: { send: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendMail: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthClient = {
      send: vi.fn((pattern, payload) => {
        if (pattern === PATTERNS.AUTH.ME) {
          if (payload.userId === 'c1') {
            return of({ id: 'c1', name: 'John Customer', email: 'john@example.com' });
          }
          if (payload.userId === 'd1') {
            return of({ id: 'd1', name: 'Bob Driver', email: 'bob@example.com' });
          }
        }
        return of(null);
      }),
    };

    mockEmailService = {
      sendMail: vi.fn().mockResolvedValue(undefined),
    };

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationServiceService,
        {
          provide: AUTH_SERVICE_TOKEN,
          useValue: mockAuthClient,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
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

  describe('sendCompletionEmails', () => {
    it('should send customer invoice and driver job slip when order is completed', async () => {
      await service.sendCompletionEmails({
        orderId: 'o1',
        customerId: 'c1',
        driverId: 'd1',
        status: OrderStatus.COMPLETED,
        fee: 15000,
        distanceM: 2500,
      });

      expect(mockAuthClient.send).toHaveBeenCalledWith(PATTERNS.AUTH.ME, { userId: 'c1' });
      expect(mockAuthClient.send).toHaveBeenCalledWith(PATTERNS.AUTH.ME, { userId: 'd1' });

      expect(mockEmailService.sendMail).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendMail).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          to: 'john@example.com',
          subject: expect.stringContaining('Bukti Transaksi'),
          html: expect.stringContaining('UrbanLogis'),
        }),
      );
      expect(mockEmailService.sendMail).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          to: 'bob@example.com',
          subject: expect.stringContaining('Tugas Selesai'),
          html: expect.stringContaining('UrbanLogis Mitra'),
        }),
      );
    });
  });
});
