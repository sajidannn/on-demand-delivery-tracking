import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceController } from './order-service.controller.js';
import { OrderServiceService } from './order-service.service.js';
import { OrderDto, OrderStatus, Role } from '@app/common';

describe('OrderServiceController', () => {
  let controller: OrderServiceController;
  let service: OrderServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderServiceController],
      providers: [
        {
          provide: OrderServiceService,
          useValue: {
            create: vi.fn(),
            get: vi.fn(),
            list: vi.fn(),
            updateStatus: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrderServiceController>(OrderServiceController);
    service = module.get<OrderServiceService>(OrderServiceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('createOrder should call service.create', async () => {
    const payload = {
      customerId: 'cust-1',
      pickup: { lat: 1, lng: 1 },
      dropoff: { lat: 2, lng: 2 },
    };
    const expected = { id: 'order-1' } as OrderDto;
    vi.mocked(service.create).mockResolvedValue(expected);

    expect(await controller.createOrder(payload)).toBe(expected);
    expect(service.create).toHaveBeenCalledWith(payload);
  });

  it('getOrder should call service.get', async () => {
    const payload = {
      orderId: 'order-1',
      userId: 'user-1',
      role: Role.CUSTOMER,
    };
    const expected = { id: 'order-1' } as OrderDto;
    vi.mocked(service.get).mockResolvedValue(expected);

    expect(await controller.getOrder(payload)).toBe(expected);
    expect(service.get).toHaveBeenCalledWith(
      payload.orderId,
      payload.userId,
      payload.role,
    );
  });

  it('listOrders should call service.list', async () => {
    const payload = { userId: 'user-1', role: Role.CUSTOMER };
    const expected = [{ id: 'order-1' }] as OrderDto[];
    vi.mocked(service.list).mockResolvedValue(expected);

    expect(await controller.listOrders(payload)).toBe(expected);
    expect(service.list).toHaveBeenCalledWith(payload.userId, payload.role);
  });

  it('updateOrderStatus should call service.updateStatus', async () => {
    const payload = {
      orderId: 'order-1',
      driverId: 'driver-1',
      status: OrderStatus.PICKED_UP,
    };
    const expected = { id: 'order-1' } as OrderDto;
    vi.mocked(service.updateStatus).mockResolvedValue(expected);

    expect(await controller.updateOrderStatus(payload)).toBe(expected);
    expect(service.updateStatus).toHaveBeenCalledWith(payload);
  });
});
