import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceService } from './order-service.service.js';
import { OrderRepository } from './order.repository.js';
import { OrderStateMachine } from './order-state-machine.service.js';
import { OrderEventsPublisher } from './order-events.publisher.js';
import { ConfigService } from '@nestjs/config';
import { LOCATION_SERVICE_NAME, OrderStatus, Role, RouteSource } from '@app/common';
import { RoutingService } from './routing/routing.service.js';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

describe('OrderServiceService', () => {
  let service: OrderServiceService;
  let repo: Record<string, ReturnType<typeof vi.fn>>;
  let stateMachine: Record<string, ReturnType<typeof vi.fn>>;
  let locationServiceMock: Record<string, ReturnType<typeof vi.fn>>;
  let publisherMock: Record<string, ReturnType<typeof vi.fn>>;
  let routingServiceMock: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    repo = {
      createOrder: vi.fn(),
      findById: vi.fn(),
      findByCustomerId: vi.fn(),
      findByDriverId: vi.fn(),
      findHistoryByOrderId: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn(),
      updateDriverAndStatus: vi.fn(),
    };

    stateMachine = {
      validateTransition: vi.fn(),
    };

    locationServiceMock = {
      reserveNearestDriver: vi.fn(),
      releaseDriver: vi.fn(),
    };

    publisherMock = {
      created: vi.fn().mockResolvedValue(undefined),
      driverAssigned: vi.fn().mockResolvedValue(undefined),
      statusChanged: vi.fn().mockResolvedValue(undefined),
    };

    routingServiceMock = {
      getRouteEstimate: vi.fn().mockResolvedValue({
        distanceM: 2000,
        durationS: 300,
        routeSource: RouteSource.OSRM,
        route: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderServiceService,
        { provide: OrderRepository, useValue: repo },
        { provide: OrderStateMachine, useValue: stateMachine },
        { provide: OrderEventsPublisher, useValue: publisherMock },
        { provide: RoutingService, useValue: routingServiceMock },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(3000) },
        },
        {
          provide: LOCATION_SERVICE_NAME,
          useValue: {
            getService: vi.fn().mockReturnValue(locationServiceMock),
          },
        },
      ],
    }).compile();

    service = module.get<OrderServiceService>(OrderServiceService);
    // Initialize module to bind location service
    service.onModuleInit();
  });

  describe('create', () => {
    const created_at = new Date('2026-10-09T07:12:00.000Z');
    const occurredPending = new Date('2026-10-09T07:12:03.120Z');
    const occurredAssigned = new Date('2026-10-09T07:13:00.000Z');
    const occurredNoDriver = new Date('2026-10-09T07:13:30.000Z');

    it('should assign driver if reserveNearest finds one (reserve ketemu)', async () => {
      repo.createOrder.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
        created_at,
        occurred_at: occurredPending,
      });
      locationServiceMock.reserveNearestDriver.mockReturnValue(
        of({ found: true, driver: { driverId: 'driver-1' } }),
      );
      repo.updateDriverAndStatus.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.DRIVER_ASSIGNED,
        updated_at: occurredAssigned,
        occurred_at: occurredAssigned,
      });

      const payload = {
        customerId: 'cust-1',
        pickup: { lat: 1, lng: 1 },
        dropoff: { lat: 2, lng: 2 },
      };
      const res = await service.create(payload);

      expect(res.status).toBe(OrderStatus.DRIVER_ASSIGNED);
      expect(res.driverId).toBe('driver-1');
      expect(repo.updateDriverAndStatus).toHaveBeenCalledWith(
        'order-1',
        'driver-1',
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.PENDING,
        'SYSTEM',
        null,
        null,
      );
      expect(publisherMock.created).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        at: occurredPending.toISOString(),
      });
      expect(publisherMock.driverAssigned).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        driverId: 'driver-1',
        at: occurredAssigned.toISOString(),
      });
    });

    it('should set NO_DRIVER_AVAILABLE if no driver found (reserve tidak ketemu)', async () => {
      repo.createOrder.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
        created_at,
        occurred_at: occurredPending,
      });
      locationServiceMock.reserveNearestDriver.mockReturnValue(
        of({ found: false }),
      );
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.NO_DRIVER_AVAILABLE,
        updated_at: occurredNoDriver,
        occurred_at: occurredNoDriver,
      });

      const payload = {
        customerId: 'cust-1',
        pickup: { lat: 1, lng: 1 },
        dropoff: { lat: 2, lng: 2 },
      };
      const res = await service.create(payload);

      expect(res.status).toBe(OrderStatus.NO_DRIVER_AVAILABLE);
      expect(repo.updateStatus).toHaveBeenCalledWith(
        'order-1',
        OrderStatus.NO_DRIVER_AVAILABLE,
        OrderStatus.PENDING,
        'SYSTEM',
        null,
        'NO_DRIVER',
      );
      expect(publisherMock.created).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        at: occurredPending.toISOString(),
      });
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        status: OrderStatus.NO_DRIVER_AVAILABLE,
        at: occurredNoDriver.toISOString(),
      });
    });

    it('should set NO_DRIVER_AVAILABLE and call releaseQuietly on error (error + release)', async () => {
      repo.createOrder.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
        created_at,
        occurred_at: occurredPending,
      });
      locationServiceMock.reserveNearestDriver.mockReturnValue(
        throwError(() => new Error('timeout')),
      );
      locationServiceMock.releaseDriver.mockReturnValue(of({ released: true }));
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.NO_DRIVER_AVAILABLE,
        updated_at: occurredNoDriver,
        occurred_at: occurredNoDriver,
      });

      const payload = {
        customerId: 'cust-1',
        pickup: { lat: 1, lng: 1 },
        dropoff: { lat: 2, lng: 2 },
      };
      const res = await service.create(payload);

      expect(res.status).toBe(OrderStatus.NO_DRIVER_AVAILABLE);
      expect(locationServiceMock.releaseDriver).toHaveBeenCalled();
      expect(publisherMock.created).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        at: occurredPending.toISOString(),
      });
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        status: OrderStatus.NO_DRIVER_AVAILABLE,
        at: occurredNoDriver.toISOString(),
      });
    });
  });

  describe('get', () => {
    it('should throw FORBIDDEN if customer gets other customer order (ownership get)', async () => {
      repo.findById.mockResolvedValue({ id: 'order-1', customer_id: 'cust-2' });
      await expect(
        service.get('order-1', 'cust-1', Role.CUSTOMER),
      ).rejects.toMatchObject({ message: 'Akses ditolak' });
    });

    it('should throw FORBIDDEN if driver gets other driver order (ownership get)', async () => {
      repo.findById.mockResolvedValue({
        id: 'order-1',
        customer_id: 'cust-1',
        driver_id: 'driver-2',
      });
      await expect(
        service.get('order-1', 'driver-1', Role.DRIVER),
      ).rejects.toMatchObject({ message: 'Akses ditolak' });
    });

    it('should return order if owner matches', async () => {
      repo.findById.mockResolvedValue({ id: 'order-1', customer_id: 'cust-1' });
      const res = await service.get('order-1', 'cust-1', Role.CUSTOMER);
      expect(res.id).toBe('order-1');
    });

    it('should include history timeline mapped from order_status_history rows', async () => {
      repo.findById.mockResolvedValue({
        id: 'order-1',
        customer_id: 'cust-1',
        status: OrderStatus.COMPLETED,
      });
      repo.findHistoryByOrderId.mockResolvedValue([
        {
          to_status: OrderStatus.PENDING,
          actor_type: 'CUSTOMER',
          occurred_at: new Date('2026-10-09T07:12:03.120Z'),
        },
        {
          to_status: OrderStatus.DRIVER_ASSIGNED,
          actor_type: 'SYSTEM',
          occurred_at: new Date('2026-10-09T07:13:00.000Z'),
        },
      ]);

      const res = await service.get('order-1', 'cust-1', Role.CUSTOMER);

      expect(repo.findHistoryByOrderId).toHaveBeenCalledWith('order-1');
      expect(res.history).toEqual([
        { status: OrderStatus.PENDING, at: '2026-10-09T07:12:03.120Z', actor: 'CUSTOMER' },
        { status: OrderStatus.DRIVER_ASSIGNED, at: '2026-10-09T07:13:00.000Z', actor: 'SYSTEM' },
      ]);
    });
  });

  describe('list', () => {
    it('should return orders without history property', async () => {
      repo.findByCustomerId.mockResolvedValue([
        { id: 'order-1', customer_id: 'cust-1', status: OrderStatus.PENDING },
      ]);

      const res = await service.list('cust-1', Role.CUSTOMER);

      expect(res).toHaveLength(1);
      expect(res[0]).not.toHaveProperty('history');
    });
  });

  describe('updateStatus', () => {
    it('should throw FORBIDDEN (403) if driverId does not match', async () => {
      repo.findById.mockResolvedValue({ id: 'order-1', driver_id: 'driver-2' });
      await expect(
        service.updateStatus({
          orderId: 'order-1',
          driverId: 'driver-1',
          status: OrderStatus.PICKED_UP,
        }),
      ).rejects.toMatchObject({ message: 'Akses ditolak' });
    });

    it('should throw RpcException (409) if transition is illegal', async () => {
      repo.findById.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.PENDING,
      });
      stateMachine.validateTransition.mockImplementation(() => {
        throw new RpcException({ code: 'INVALID_STATUS_TRANSITION' });
      });
      await expect(
        service.updateStatus({
          orderId: 'order-1',
          driverId: 'driver-1',
          status: OrderStatus.COMPLETED,
        }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_STATUS_TRANSITION' } });
      expect(publisherMock.statusChanged).not.toHaveBeenCalled();
    });

    it('should call releaseQuietly when status is COMPLETED', async () => {
      const occurredAt = new Date('2026-10-09T07:14:00.000Z');
      repo.findById.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.PICKED_UP,
      });
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.COMPLETED,
        occurred_at: occurredAt,
        updated_at: occurredAt,
      });
      locationServiceMock.releaseDriver.mockReturnValue(of({ released: true }));

      await service.updateStatus({
        orderId: 'order-1',
        driverId: 'driver-1',
        status: OrderStatus.COMPLETED,
      });
      expect(locationServiceMock.releaseDriver).toHaveBeenCalled();
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: undefined,
        driverId: 'driver-1',
        status: OrderStatus.COMPLETED,
        at: occurredAt.toISOString(),
      });
    });
  });

  describe('cancel', () => {
    const occurredCancelled = new Date('2026-10-09T07:15:00.000Z');

    const assignedRow = {
      id: 'order-1',
      customer_id: 'cust-1',
      driver_id: 'driver-1',
      status: OrderStatus.DRIVER_ASSIGNED,
      updated_at: occurredCancelled,
    };

    it('should cancel order from DRIVER_ASSIGNED, release driver, and publish event (success)', async () => {
      repo.findById.mockResolvedValue(assignedRow);
      repo.updateStatus.mockResolvedValue({
        ...assignedRow,
        status: OrderStatus.CANCELLED,
        occurred_at: occurredCancelled,
      });
      locationServiceMock.releaseDriver.mockReturnValue(of({ released: true }));
      repo.findHistoryByOrderId.mockResolvedValue([
        {
          to_status: OrderStatus.CANCELLED,
          actor_type: 'CUSTOMER',
          occurred_at: occurredCancelled,
        },
      ]);

      const res = await service.cancel({ orderId: 'order-1', customerId: 'cust-1' });

      expect(repo.updateStatus).toHaveBeenCalledWith(
        'order-1',
        OrderStatus.CANCELLED,
        OrderStatus.DRIVER_ASSIGNED,
        'CUSTOMER',
        'cust-1',
        'CUSTOMER_CANCEL',
      );
      expect(stateMachine.validateTransition).toHaveBeenCalledWith(
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.CANCELLED,
      );
      expect(locationServiceMock.releaseDriver).toHaveBeenCalled();
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        driverId: 'driver-1',
        status: OrderStatus.CANCELLED,
        at: occurredCancelled.toISOString(),
      });
      expect(res.status).toBe(OrderStatus.CANCELLED);
      expect(res.history).toEqual([
        { status: OrderStatus.CANCELLED, at: occurredCancelled.toISOString(), actor: 'CUSTOMER' },
      ]);
    });

    it('should cancel order from PENDING without releasing driver (no driver)', async () => {
      repo.findById.mockResolvedValue({
        id: 'order-1',
        customer_id: 'cust-1',
        driver_id: null,
        status: OrderStatus.PENDING,
      });
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        customer_id: 'cust-1',
        driver_id: null,
        status: OrderStatus.CANCELLED,
        occurred_at: occurredCancelled,
        updated_at: occurredCancelled,
      });

      await service.cancel({ orderId: 'order-1', customerId: 'cust-1' });

      expect(locationServiceMock.releaseDriver).not.toHaveBeenCalled();
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({
        orderId: 'order-1',
        customerId: 'cust-1',
        driverId: undefined,
        status: OrderStatus.CANCELLED,
        at: occurredCancelled.toISOString(),
      });
    });

    it('should throw INVALID_STATUS_TRANSITION (409) if race lost (updateStatus returns null)', async () => {
      repo.findById.mockResolvedValue(assignedRow);
      repo.updateStatus.mockResolvedValue(null);

      await expect(
        service.cancel({ orderId: 'order-1', customerId: 'cust-1' }),
      ).rejects.toMatchObject({
        error: { code: 'INVALID_STATUS_TRANSITION' },
      });
      expect(locationServiceMock.releaseDriver).not.toHaveBeenCalled();
      expect(publisherMock.statusChanged).not.toHaveBeenCalled();
    });

    it('should throw FORBIDDEN (403) if customer is not the owner', async () => {
      repo.findById.mockResolvedValue({ id: 'order-1', customer_id: 'cust-2' });
      await expect(
        service.cancel({ orderId: 'order-1', customerId: 'cust-1' }),
      ).rejects.toMatchObject({ error: { code: 'FORBIDDEN' } });
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND (404) if order does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.cancel({ orderId: 'order-1', customerId: 'cust-1' }),
      ).rejects.toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('should throw INVALID_STATUS_TRANSITION (409) if order already PICKED_UP', async () => {
      repo.findById.mockResolvedValue({
        id: 'order-1',
        customer_id: 'cust-1',
        driver_id: 'driver-1',
        status: OrderStatus.PICKED_UP,
      });
      stateMachine.validateTransition.mockImplementation(() => {
        throw new RpcException({ code: 'INVALID_STATUS_TRANSITION' });
      });

      await expect(
        service.cancel({ orderId: 'order-1', customerId: 'cust-1' }),
      ).rejects.toMatchObject({ error: { code: 'INVALID_STATUS_TRANSITION' } });
      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(locationServiceMock.releaseDriver).not.toHaveBeenCalled();
    });
  });
});
