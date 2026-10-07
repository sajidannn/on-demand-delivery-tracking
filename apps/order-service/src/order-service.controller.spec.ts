import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceController } from './order-service.controller.js';
import { OrderServiceService } from './order-service.service.js';
import { OrderDto, OrderStatus, Role } from '@app/common';

describe('OrderServiceController', () => {
  let controller: OrderServiceController;

  let createSpy: ReturnType<typeof vi.fn>;
  let getSpy: ReturnType<typeof vi.fn>;
  let listSpy: ReturnType<typeof vi.fn>;
  let updateStatusSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createSpy = vi.fn();
    getSpy = vi.fn();
    listSpy = vi.fn();
    updateStatusSpy = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderServiceController],
      providers: [
        {
          provide: OrderServiceService,
          useValue: {
            create: createSpy,
            get: getSpy,
            list: listSpy,
            updateStatus: updateStatusSpy,
          },
        },
      ],
    }).compile();

    controller = module.get<OrderServiceController>(OrderServiceController);
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
    vi.mocked(createSpy).mockResolvedValue(expected);

    expect(await controller.createOrder(payload)).toBe(expected);
    expect(createSpy).toHaveBeenCalledWith(payload);
  });

  it('getOrder should call service.get', async () => {
    const payload = {
      orderId: 'order-1',
      userId: 'user-1',
      role: Role.CUSTOMER,
    };
    const expected = { id: 'order-1' } as OrderDto;
    vi.mocked(getSpy).mockResolvedValue(expected);

    expect(await controller.getOrder(payload)).toBe(expected);
    expect(getSpy).toHaveBeenCalledWith(
      payload.orderId,
      payload.userId,
      payload.role,
    );
  });

  it('listOrders should call service.list', async () => {
    const payload = { userId: 'user-1', role: Role.CUSTOMER };
    const expected = [{ id: 'order-1' }] as OrderDto[];
    vi.mocked(listSpy).mockResolvedValue(expected);

    expect(await controller.listOrders(payload)).toBe(expected);
    expect(listSpy).toHaveBeenCalledWith(payload.userId, payload.role);
  });

  it('updateOrderStatus should call service.updateStatus', async () => {
    const payload = {
      orderId: 'order-1',
      driverId: 'driver-1',
      status: OrderStatus.PICKED_UP,
    };
    const expected = { id: 'order-1' } as OrderDto;
    vi.mocked(updateStatusSpy).mockResolvedValue(expected);

    expect(await controller.updateOrderStatus(payload)).toBe(expected);
    expect(updateStatusSpy).toHaveBeenCalledWith(payload);
  });
});
