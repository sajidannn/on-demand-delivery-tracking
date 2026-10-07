import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceService } from './order-service.service.js';
import { OrderRepository } from './order.repository.js';
import { OrderStateMachine } from './order-state-machine.service.js';
import { OrderEventsPublisher } from './order-events.publisher.js';
import { ConfigService } from '@nestjs/config';
import { LOCATION_SERVICE_NAME, OrderStatus, Role } from '@app/common';
import { RpcException } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';

describe('OrderServiceService', () => {
  let service: OrderServiceService;
  let repo: any;
  let stateMachine: any;
  let locationServiceMock: any;
  let publisherMock: any;

  beforeEach(async () => {
    repo = {
      createOrder: vi.fn(),
      findById: vi.fn(),
      findByCustomerId: vi.fn(),
      findByDriverId: vi.fn(),
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
      created: vi.fn(),
      driverAssigned: vi.fn(),
      statusChanged: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderServiceService,
        { provide: OrderRepository, useValue: repo },
        { provide: OrderStateMachine, useValue: stateMachine },
        { provide: OrderEventsPublisher, useValue: publisherMock },
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
    it('should assign driver if reserveNearest finds one (reserve ketemu)', async () => {
      repo.createOrder.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      locationServiceMock.reserveNearestDriver.mockReturnValue(
        of({ found: true, driver: { driverId: 'driver-1' } }),
      );
      repo.updateDriverAndStatus.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.DRIVER_ASSIGNED,
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
      );
      expect(publisherMock.created).toHaveBeenCalledWith({ orderId: 'order-1', customerId: 'cust-1' });
      expect(publisherMock.driverAssigned).toHaveBeenCalledWith({ orderId: 'order-1', customerId: 'cust-1', driverId: 'driver-1' });
    });

    it('should set NO_DRIVER_AVAILABLE if no driver found (reserve tidak ketemu)', async () => {
      repo.createOrder.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      locationServiceMock.reserveNearestDriver.mockReturnValue(
        of({ found: false }),
      );
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.NO_DRIVER_AVAILABLE,
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
      );
      expect(publisherMock.created).toHaveBeenCalledWith({ orderId: 'order-1', customerId: 'cust-1' });
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({ orderId: 'order-1', customerId: 'cust-1', status: OrderStatus.NO_DRIVER_AVAILABLE });
    });

    it('should set NO_DRIVER_AVAILABLE and call releaseQuietly on error (error + release)', async () => {
      repo.createOrder.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.PENDING,
      });
      locationServiceMock.reserveNearestDriver.mockReturnValue(
        throwError(() => new Error('timeout')),
      );
      locationServiceMock.releaseDriver.mockReturnValue(of({ released: true }));
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.NO_DRIVER_AVAILABLE,
      });

      const payload = {
        customerId: 'cust-1',
        pickup: { lat: 1, lng: 1 },
        dropoff: { lat: 2, lng: 2 },
      };
      const res = await service.create(payload);

      expect(res.status).toBe(OrderStatus.NO_DRIVER_AVAILABLE);
      expect(locationServiceMock.releaseDriver).toHaveBeenCalled();
      expect(publisherMock.created).toHaveBeenCalledWith({ orderId: 'order-1', customerId: 'cust-1' });
      expect(publisherMock.statusChanged).toHaveBeenCalledWith({ orderId: 'order-1', customerId: 'cust-1', status: OrderStatus.NO_DRIVER_AVAILABLE });
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
      repo.findById.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.PICKED_UP,
      });
      repo.updateStatus.mockResolvedValue({
        id: 'order-1',
        driver_id: 'driver-1',
        status: OrderStatus.COMPLETED,
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
      });
    });
  });
});
