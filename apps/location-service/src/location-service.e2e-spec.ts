import { Test, TestingModule } from '@nestjs/testing';
import { LocationServiceService } from './location-service.service.js';
import { DriverLocationRepository } from './driver-location.repository.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { status } from '@grpc/grpc-js';
import { DataSource } from 'typeorm';

import { CreateDriverLocations1790923737229 } from './migrations/1790923737229-CreateDriverLocations.js';
import { AddCurrentOrderIdToDriverLocations1791234567000 } from './migrations/1791234567000-AddCurrentOrderIdToDriverLocations.js';

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
            url:
              config.get('LOCATION_TEST_DATABASE_URL') ||
              'postgresql://postgres:postgres@localhost:5432/location_test_db',
            synchronize: false,
            migrationsRun: true,
            migrations: [
              CreateDriverLocations1790923737229,
              AddCurrentOrderIdToDriverLocations1791234567000,
            ],
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
        service.setAvailability({
          driverId: '00000000-0000-0000-0000-000000000000',
          isAvailable: true,
          lat: 100,
          lng: 0,
        }),
      ).rejects.toMatchObject({ error: { code: status.INVALID_ARGUMENT } });
    });

    it('should throw INVALID_ARGUMENT for invalid lng', async () => {
      await expect(
        service.setAvailability({
          driverId: '00000000-0000-0000-0000-000000000000',
          isAvailable: true,
          lat: 0,
          lng: -200,
        }),
      ).rejects.toMatchObject({ error: { code: status.INVALID_ARGUMENT } });
    });
  });

  describe('jalur offline', () => {
    it('should mark driver as offline without coordinate validation', async () => {
      // Panggil dengan coordinate invalid tapi isAvailable false
      await expect(
        service.setAvailability({
          driverId: '00000000-0000-0000-0000-000000000000',
          isAvailable: false,
          lat: 999,
          lng: 999,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('PostGIS sungguhan (AC-03)', () => {
    it('should find 3 drivers ordered by distance', async () => {
      // Driver 1: Very close
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000001',
        isAvailable: true,
        lat: -6.2,
        lng: 106.8,
      });
      // Driver 2: Medium distance
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000002',
        isAvailable: true,
        lat: -6.21,
        lng: 106.81,
      });
      // Driver 3: Far
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000003',
        isAvailable: true,
        lat: -6.25,
        lng: 106.85,
      });

      const drivers = await service.findNearest({
        lat: -6.2,
        lng: 106.8,
        radiusM: 10000, // 10km
        limit: 3,
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

  describe('Reserve Driver (Concurrency & Locking)', () => {
    it('should reserve the nearest driver and hide it from findNearest', async () => {
      // Driver 4 and 5
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000004',
        isAvailable: true,
        lat: -6.22,
        lng: 106.82,
      });
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000005',
        isAvailable: true,
        lat: -6.23,
        lng: 106.83,
      });

      // Reserve driver 4
      const res = await service.reserveNearest({
        orderId: '11111111-1111-1111-1111-111111111111',
        lat: -6.22,
        lng: 106.82,
        radiusM: 10000,
      });
      expect(res.found).toBe(true);
      expect(res.driver?.driverId).toBe('00000000-0000-0000-0000-000000000004');

      // Now findNearest should not return driver 4
      const drivers = await service.findNearest({
        lat: -6.22,
        lng: 106.82,
        radiusM: 10000,
        limit: 10,
      });
      const foundDriver4 = drivers.find(
        (d) => d.driverId === '00000000-0000-0000-0000-000000000004',
      );
      expect(foundDriver4).toBeUndefined();

      // Reserve again should pick driver 5
      const res2 = await service.reserveNearest({
        orderId: '22222222-2222-2222-2222-222222222222',
        lat: -6.22,
        lng: 106.82,
        radiusM: 10000,
      });
      expect(res2.found).toBe(true);
      expect(res2.driver?.driverId).toBe(
        '00000000-0000-0000-0000-000000000005',
      );

      // Release driver 4
      const releaseRes = await service.releaseDriver({
        orderId: '11111111-1111-1111-1111-111111111111',
      });
      expect(releaseRes.released).toBe(true);

      // Release non-existent order
      const releaseResNonExistent = await service.releaseDriver({
        orderId: '99999999-9999-9999-9999-999999999999',
      });
      expect(releaseResNonExistent.released).toBe(false);

      // Now driver 4 should be back
      const driversAfterRelease = await service.findNearest({
        lat: -6.22,
        lng: 106.82,
        radiusM: 10000,
        limit: 10,
      });
      const foundDriver4After = driversAfterRelease.find(
        (d) => d.driverId === '00000000-0000-0000-0000-000000000004',
      );
      expect(foundDriver4After).toBeDefined();
    });

    it('should not allow two concurrent reservations to pick the same driver', async () => {
      // Clear
      await dataSource.query('DELETE FROM driver_locations');

      // Driver 6
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000006',
        isAvailable: true,
        lat: -6.2,
        lng: 106.8,
      });

      // Run two reserves concurrently
      const [res1, res2] = await Promise.all([
        service.reserveNearest({
          orderId: '33333333-3333-3333-3333-333333333333',
          lat: -6.2,
          lng: 106.8,
          radiusM: 10000,
        }),
        service.reserveNearest({
          orderId: '44444444-4444-4444-4444-444444444444',
          lat: -6.2,
          lng: 106.8,
          radiusM: 10000,
        }),
      ]);

      // Exactly one should succeed
      expect((res1.found && !res2.found) || (!res1.found && res2.found)).toBe(
        true,
      );
    });
  });

  describe('Ping Lokasi Real-time (RMQ)', () => {
    it('should upsert location via ping without making driver available (Scenario 6 & 7)', async () => {
      // Driver 7 offline ping
      await service.updateLocation('00000000-0000-0000-0000-000000000007', -6.1, 106.1);
      
      const drivers = await service.findNearest({
        lat: -6.1,
        lng: 106.1,
        radiusM: 10000,
        limit: 10,
      });
      // Should not be found because is_available is false (default for new row)
      const foundDriver7 = drivers.find((d) => d.driverId === '00000000-0000-0000-0000-000000000007');
      expect(foundDriver7).toBeUndefined();

      // Now make driver 7 available
      await service.setAvailability({
        driverId: '00000000-0000-0000-0000-000000000007',
        isAvailable: true,
        lat: -6.1,
        lng: 106.1,
      });

      // Ping a new location
      await service.updateLocation('00000000-0000-0000-0000-000000000007', -6.15, 106.15);

      const drivers2 = await service.findNearest({
        lat: -6.15,
        lng: 106.15,
        radiusM: 10000,
        limit: 10,
      });
      const foundDriver7Again = drivers2.find((d) => d.driverId === '00000000-0000-0000-0000-000000000007');
      expect(foundDriver7Again).toBeDefined();
      expect(foundDriver7Again?.lat).toBe(-6.15);
      expect(foundDriver7Again?.lng).toBe(106.15);
    });

    it('should throw error for invalid coordinates in ping (Scenario 8)', async () => {
      await expect(
        service.updateLocation('00000000-0000-0000-0000-000000000008', 999, 999),
      ).rejects.toMatchObject({ error: { code: status.INVALID_ARGUMENT } });
    });
  });
});
