import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type {
  FindNearestDriversRequest,
  NearbyDriver,
  SetDriverAvailabilityRequest,
  ReserveNearestDriverRequest,
  ReserveNearestDriverResponse,
  ReleaseDriverRequest,
  ReleaseDriverResponse,
} from '@app/common';
import { status } from '@grpc/grpc-js';
import { DriverLocationRepository } from './driver-location.repository.js';

const DEFAULT_RADIUS_M = 3000;
const DEFAULT_LIMIT = 1;

@Injectable()
export class LocationServiceService {
  private readonly logger = new Logger(LocationServiceService.name);

  constructor(private readonly repo: DriverLocationRepository) {}

  async findNearest(req: FindNearestDriversRequest): Promise<NearbyDriver[]> {
    this.assertCoordinate(req.lat, req.lng);
    const rows = await this.repo.findNearest(
      req.lng,
      req.lat,
      req.radiusM || DEFAULT_RADIUS_M,
      req.limit || DEFAULT_LIMIT,
    );
    return rows.map((r) => ({
      driverId: r.driver_id,
      distanceM: r.distance_m,
      lat: r.lat,
      lng: r.lng,
    }));
  }

  async setAvailability(req: SetDriverAvailabilityRequest): Promise<void> {
    if (req.isAvailable) {
      this.assertCoordinate(req.lat, req.lng);
      await this.repo.markOnline(req.driverId, req.lng, req.lat);
    } else {
      await this.repo.markOffline(req.driverId);
    }
    this.logger.log(
      `Driver ${req.driverId} availability set to ${req.isAvailable}`,
    );
  }

  async reserveNearest(
    req: ReserveNearestDriverRequest,
  ): Promise<ReserveNearestDriverResponse> {
    this.assertCoordinate(req.lat, req.lng);
    const row = await this.repo.reserveNearest(
      req.orderId,
      req.lng,
      req.lat,
      req.radiusM || DEFAULT_RADIUS_M,
    );
    if (!row) {
      return { found: false, driver: undefined };
    }
    return {
      found: true,
      driver: {
        driverId: row.driver_id,
        distanceM: row.distance_m,
        lat: row.lat,
        lng: row.lng,
      },
    };
  }

  async releaseDriver(
    req: ReleaseDriverRequest,
  ): Promise<ReleaseDriverResponse> {
    const released = await this.repo.releaseByOrder(req.orderId);
    if (released) {
      this.logger.log(`Driver released for order ${req.orderId}`);
    } else {
      this.logger.debug(`No driver released for order ${req.orderId}`);
    }
    return { released };
  }

  private assertCoordinate(lat: number, lng: number): void {
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid coordinate',
      });
    }
  }
}
