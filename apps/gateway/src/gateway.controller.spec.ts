import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';
import { TrackingGateway } from './tracking.gateway.js';
import { OrderStatus } from '@app/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GatewayController', () => {
  let controller: GatewayController;
  let trackingGatewayMock: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    trackingGatewayMock = {
      broadcastOrderStatus: vi.fn(),
      clearOrderCache: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        GatewayService,
        { provide: TrackingGateway, useValue: trackingGatewayMock },
      ],
    }).compile();

    controller = module.get<GatewayController>(GatewayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health → { status: "ok" }', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('should handle driver assigned event and broadcast', () => {
    controller.handleDriverAssigned({ orderId: '1', driverId: 'd1', customerId: 'c1' });
    expect(trackingGatewayMock.broadcastOrderStatus).toHaveBeenCalledWith(
      { orderId: '1', status: OrderStatus.DRIVER_ASSIGNED, driverId: 'd1' },
      'c1',
      'd1'
    );
  });

  it('should handle status changed event and broadcast', () => {
    controller.handleStatusChanged({ orderId: '1', status: OrderStatus.PICKED_UP, driverId: 'd1', customerId: 'c1' });
    expect(trackingGatewayMock.broadcastOrderStatus).toHaveBeenCalledWith(
      { orderId: '1', status: OrderStatus.PICKED_UP, driverId: 'd1' },
      'c1',
      'd1'
    );
  });

  it('should clear cache if status is COMPLETED', () => {
    controller.handleStatusChanged({ orderId: '1', status: OrderStatus.COMPLETED, driverId: 'd1', customerId: 'c1' });
    expect(trackingGatewayMock.clearOrderCache).toHaveBeenCalledWith('1');
  });
});
