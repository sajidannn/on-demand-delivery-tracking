import { Test, TestingModule } from '@nestjs/testing';
import { LocationServiceController } from './location-service.controller.js';
import { LocationServiceService } from './location-service.service.js';
import { vi } from 'vitest';

describe('LocationServiceController', () => {
  let controller: LocationServiceController;

  const serviceMock = {
    findNearest: vi.fn(),
    setAvailability: vi.fn(),
    updateLocation: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationServiceController],
      providers: [{ provide: LocationServiceService, useValue: serviceMock }],
    }).compile();

    controller = module.get<LocationServiceController>(
      LocationServiceController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findNearestDrivers', () => {
    it('should return drivers from service', async () => {
      const mockDrivers = [
        { driverId: 'uuid-1', distanceM: 500, lat: -6.9, lng: 107.6 },
      ];
      serviceMock.findNearest.mockResolvedValue(mockDrivers);

      const result = await controller.findNearestDrivers({
        lat: -6.9147,
        lng: 107.6098,
        radiusM: 3000,
        limit: 1,
      });

      expect(result).toEqual({ drivers: mockDrivers });
      expect(serviceMock.findNearest).toHaveBeenCalledWith({
        lat: -6.9147,
        lng: 107.6098,
        radiusM: 3000,
        limit: 1,
      });
    });
  });

  describe('setDriverAvailability', () => {
    it('should return ok: true', async () => {
      serviceMock.setAvailability.mockResolvedValue(undefined);

      const result = await controller.setDriverAvailability({
        driverId: 'uuid-1',
        isAvailable: true,
        lat: -6.9,
        lng: 107.6,
      });

      expect(result).toEqual({ ok: true });
    });
  });

  describe('handleLocationUpdated', () => {
    it('should call updateLocation on service', async () => {
      serviceMock.updateLocation = vi.fn().mockResolvedValue(undefined);

      await controller.handleLocationUpdated({
        driverId: 'uuid-1',
        lat: -6.9,
        lng: 107.6,
        ts: Date.now(),
      });

      expect(serviceMock.updateLocation).toHaveBeenCalledWith('uuid-1', -6.9, 107.6);
    });
  });
});
