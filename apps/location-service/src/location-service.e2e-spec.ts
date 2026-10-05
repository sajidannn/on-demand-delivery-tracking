import { Test, TestingModule } from '@nestjs/testing';
import { LocationServiceService } from './location-service.service.js';
import { DriverLocationRepository } from './driver-location.repository.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { DataSource } from 'typeorm';

describe('LocationServiceService', () => {
  let service: LocationServiceService;
  let dataSource: DataSource;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            url: config.get('LOCATION_TEST_DATABASE_URL') || 'postgresql://postgres:postgres@localhost:5432/location_test_db',
            synchronize: true, // Use true for e2e tests so tables are created automatically
          }),
          inject: [ConfigService],
        }),
      ],
      providers: [LocationServiceService, DriverLocationRepository],
    }).compile();

    moduleRef = module;
    service = module.get<LocationServiceService>(LocationServiceService);
    dataSource = module.get<DataSource>(DataSource);

    // Clean up
    await dataSource.query('DELETE FROM driver_locations');
  });

  afterAll(async () => {
    // Clean up
    await dataSource.query('DELETE FROM driver_locations');
    await moduleRef.close();
  });

  describe('assertCoordinate', () => {
    it('should throw INVALID_ARGUMENT for invalid lat', async () => {
      await expect(
        service.setAvailability({ driverId: '00000000-0000-0000-0000-000000000000', isAvailable: true, lat: 100, lng: 0 })
      ).rejects.toMatchObject({ error: { code: status.INVALID_ARGUMENT } });
    });

    it('should throw INVALID_ARGUMENT for invalid lng', async () => {
      await expect(
        service.setAvailability({ driverId: '00000000-0000-0000-0000-000000000000', isAvailable: true, lat: 0, lng: -200 })
      ).rejects.toMatchObject({ error: { code: status.INVALID_ARGUMENT } });
    });
  });

  describe('jalur offline', () => {
    it('should mark driver as offline without coordinate validation', async () => {
      // Panggil dengan coordinate invalid tapi isAvailable false
      await expect(
        service.setAvailability({ driverId: '00000000-0000-0000-0000-000000000000', isAvailable: false, lat: 999, lng: 999 })
      ).resolves.toBeUndefined();
    });
  });

  describe('PostGIS sungguhan (AC-03)', () => {
    it('should find 3 drivers ordered by distance', async () => {
      // Driver 1: Very close
      await service.setAvailability({ driverId: '00000000-0000-0000-0000-000000000001', isAvailable: true, lat: -6.2000, lng: 106.8000 });
      // Driver 2: Medium distance
      await service.setAvailability({ driverId: '00000000-0000-0000-0000-000000000002', isAvailable: true, lat: -6.2100, lng: 106.8100 });
      // Driver 3: Far
      await service.setAvailability({ driverId: '00000000-0000-0000-0000-000000000003', isAvailable: true, lat: -6.2500, lng: 106.8500 });
      
      const drivers = await service.findNearest({
        lat: -6.2000,
        lng: 106.8000,
        radiusM: 10000, // 10km
        limit: 3
      });

      expect(drivers.length).toBe(3);
      expect(drivers[0].driverId).toBe('00000000-0000-0000-0000-000000000001');
      expect(drivers[1].driverId).toBe('00000000-0000-0000-0000-000000000002');
      expect(drivers[2].driverId).toBe('00000000-0000-0000-0000-000000000003');
      
      // Verify distances are ordered correctly
      expect(drivers[0].distanceM).toBeLessThan(drivers[1].distanceM);
      expect(drivers[1].distanceM).toBeLessThan(drivers[2].distanceM);
      
      // Verify exact distance for driver 2 (approx 1565m)
      expect(drivers[1].distanceM).toBeCloseTo(1565, -2); // toleransi ±50 m
    });
  });
});
