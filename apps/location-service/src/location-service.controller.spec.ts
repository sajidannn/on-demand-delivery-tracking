import { Test, TestingModule } from '@nestjs/testing';
import { LocationServiceController } from './location-service.controller.js';
import { LocationServiceService } from './location-service.service.js';

describe('LocationServiceController', () => {
  let locationServiceController: LocationServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [LocationServiceController],
      providers: [LocationServiceService],
    }).compile();

    locationServiceController = app.get<LocationServiceController>(LocationServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(locationServiceController.getHello()).toBe('Hello World!');
    });
  });
});
