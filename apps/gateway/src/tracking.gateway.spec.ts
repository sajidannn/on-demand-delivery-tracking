import { Test, TestingModule } from '@nestjs/testing';
import { TrackingGateway } from './tracking.gateway.js';
import {
  AUTH_SERVICE_TOKEN,
  ORDER_SERVICE_TOKEN,
  LOCATION_CLIENT_TOKEN,
  PATTERNS,
  userRoom,
  EVENTS,
  WS_EVENTS,
  orderRoom,
} from '@app/common';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Socket } from 'socket.io';

describe('TrackingGateway', () => {
  let gateway: TrackingGateway;
  let authClient: Record<string, ReturnType<typeof vi.fn>>;
  let orderClient: Record<string, ReturnType<typeof vi.fn>>;
  let locationClient: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    authClient = { send: vi.fn() };
    orderClient = { send: vi.fn() };
    locationClient = { emit: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        { provide: AUTH_SERVICE_TOKEN, useValue: authClient },
        { provide: ORDER_SERVICE_TOKEN, useValue: orderClient },
        { provide: LOCATION_CLIENT_TOKEN, useValue: locationClient },
      ],
    }).compile();

    gateway = module.get<TrackingGateway>(TrackingGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should join user room if token is valid', async () => {
      const mockClient = {
        handshake: { auth: { token: 'valid-token' } },
        data: {},
        join: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as Socket;

      authClient.send.mockReturnValue(
        of({ userId: 'user-1', role: 'CUSTOMER' }),
      );

      await gateway.handleConnection(mockClient);

      expect(authClient.send).toHaveBeenCalledWith(
        PATTERNS.AUTH.VALIDATE_TOKEN,
        { token: 'valid-token' },
      );
      expect(mockClient.data.user).toEqual({
        userId: 'user-1',
        role: 'CUSTOMER',
      });
      expect(mockClient.join).toHaveBeenCalledWith(userRoom('user-1'));
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect if token is invalid or missing', async () => {
      const mockClient = {
        handshake: { auth: {} },
        data: {},
        join: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);

      mockClient.handshake.auth.token = 'invalid-token';
      vi.mocked(mockClient.disconnect).mockClear();
      authClient.send.mockReturnValue(
        throwError(() => ({ code: 'UNAUTHORIZED' })),
      );

      await gateway.handleConnection(mockClient);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDriverLocation', () => {
    it('should throw FORBIDDEN if user is not a driver', async () => {
      const mockClient = { data: { user: { role: 'CUSTOMER' } } } as any;
      await expect(
        gateway.handleDriverLocation(mockClient, { lat: 10, lng: 20 }),
      ).rejects.toThrow('Only drivers allowed');
    });

    it('should emit location to RMQ', async () => {
      const mockClient = { data: { user: { role: 'DRIVER', userId: 'driver-1' } } } as any;
      await gateway.handleDriverLocation(mockClient, { lat: 10, lng: 20 });
      expect(locationClient.emit).toHaveBeenCalledWith(EVENTS.DRIVER.LOCATION_UPDATED, expect.objectContaining({
        driverId: 'driver-1',
        lat: 10,
        lng: 20,
      }));
    });

    it('should forward to room if orderId exists and access is allowed', async () => {
      const mockClient = { 
        data: { user: { role: 'DRIVER', userId: 'driver-1' }, activeOrders: new Map() },
      } as any;
      gateway.server = { to: vi.fn().mockReturnThis(), emit: vi.fn() } as any;
      
      orderClient.send.mockReturnValue(of({ driverId: 'driver-1', status: 'PICKED_UP' }));
      
      await gateway.handleDriverLocation(mockClient, { lat: 10, lng: 20, orderId: 'order-1' });
      
      expect(orderClient.send).toHaveBeenCalledWith(PATTERNS.ORDER.GET, { orderId: 'order-1', userId: 'driver-1', role: 'DRIVER' });
      expect(mockClient.data.activeOrders.get('order-1')).toBe(true);
      expect(gateway.server.to).toHaveBeenCalledWith(orderRoom('order-1'));
      expect((gateway.server.to('test') as any).emit).toHaveBeenCalledWith(WS_EVENTS.ORDER_LOCATION, expect.objectContaining({
        orderId: 'order-1', lat: 10, lng: 20
      }));
    });

    it('should throw FORBIDDEN if order access is denied', async () => {
      const mockClient = { 
        data: { user: { role: 'DRIVER', userId: 'driver-1' }, activeOrders: new Map() },
      } as any;
      
      orderClient.send.mockReturnValue(of({ driverId: 'other-driver', status: 'PICKED_UP' }));
      
      await expect(
        gateway.handleDriverLocation(mockClient, { lat: 10, lng: 20, orderId: 'order-1' }),
      ).rejects.toThrow('Order mismatch');
    });
  });

  describe('handleOrderSubscribe', () => {
    it('should throw FORBIDDEN if user is not a customer', async () => {
      const mockClient = { data: { user: { role: 'DRIVER' } } } as any;
      await expect(
        gateway.handleOrderSubscribe(mockClient, { orderId: 'order-1' }),
      ).rejects.toThrow('Only customers allowed');
    });

    it('should throw if order fetch fails', async () => {
      const mockClient = { data: { user: { role: 'CUSTOMER', userId: 'cust-1' } } } as any;
      orderClient.send.mockReturnValue(throwError(() => ({ code: 'FORBIDDEN' })));
      
      await expect(
        gateway.handleOrderSubscribe(mockClient, { orderId: 'order-1' }),
      ).rejects.toThrow();
    });

    it('should join room and return ack on success', async () => {
      const mockClient = { 
        data: { user: { role: 'CUSTOMER', userId: 'cust-1' } },
        join: vi.fn(),
      } as any;
      
      orderClient.send.mockReturnValue(of({ status: 'PENDING', driverId: 'driver-2' }));
      
      const result = await gateway.handleOrderSubscribe(mockClient, { orderId: 'order-1' });
      
      expect(orderClient.send).toHaveBeenCalledWith(PATTERNS.ORDER.GET, { orderId: 'order-1', userId: 'cust-1', role: 'CUSTOMER' });
      expect(mockClient.join).toHaveBeenCalledWith(orderRoom('order-1'));
      expect(result).toEqual({ ok: true, status: 'PENDING', driverId: 'driver-2' });
    });
  });

  describe('broadcastOrderStatus', () => {
    it('should emit status to all rooms via array', () => {
      const mockEmit = vi.fn();
      gateway.server = { to: vi.fn(() => ({ emit: mockEmit })) } as any;
      
      gateway.broadcastOrderStatus({ orderId: 'o1', status: 'PICKED_UP' } as any, 'c1', 'd1');
      
      expect(gateway.server.to).toHaveBeenCalledWith([orderRoom('o1'), userRoom('c1'), userRoom('d1')]);
      expect(mockEmit).toHaveBeenCalledWith(WS_EVENTS.ORDER_STATUS, expect.any(Object));
    });
  });

  describe('clearOrderCache', () => {
    it('should delete activeOrders for given orderId', () => {
      const mockSockets = new Map();
      const s1 = { data: { activeOrders: new Map([['o1', true], ['o2', false]]) } };
      const s2 = { data: { activeOrders: new Map([['o1', true]]) } };
      const s3 = { data: {} };
      mockSockets.set('1', s1);
      mockSockets.set('2', s2);
      mockSockets.set('3', s3);
      gateway.server = { sockets: { sockets: mockSockets } } as any;

      gateway.clearOrderCache('o1');

      expect(s1.data.activeOrders.has('o1')).toBe(false);
      expect(s1.data.activeOrders.has('o2')).toBe(true);
      expect(s2.data.activeOrders.has('o1')).toBe(false);
    });
  });
});
