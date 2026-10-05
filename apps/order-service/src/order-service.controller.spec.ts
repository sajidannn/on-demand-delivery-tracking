import { Test, TestingModule } from '@nestjs/testing';
import { OrderServiceController } from './order-service.controller.js';
import { OrderServiceService } from './order-service.service.js';

describe('OrderServiceController', () => {
  let orderServiceController: OrderServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [OrderServiceController],
      providers: [
        {
          provide: OrderServiceService,
          useValue: {},
        },
      ],
    }).compile();

    orderServiceController = app.get<OrderServiceController>(
      OrderServiceController,
    );
  });

  describe('root', () => {
    it('should be defined', () => {
      expect(orderServiceController).toBeDefined();
    });
  });
});
