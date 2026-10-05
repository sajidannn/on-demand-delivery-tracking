import { Controller } from '@nestjs/common';
import {
  LocationServiceController as ILocationServiceController,
  LocationServiceControllerMethods,
  FindNearestDriversRequest,
  FindNearestDriversResponse,
  SetDriverAvailabilityRequest,
  SetDriverAvailabilityResponse,
  ReserveNearestDriverRequest,
  ReserveNearestDriverResponse,
  ReleaseDriverRequest,
  ReleaseDriverResponse,
} from '@app/common'; // Karena sudah kita export di libs/common
import { LocationServiceService } from './location-service.service.js';

@Controller()
@LocationServiceControllerMethods() // Decorator ini dari ts-proto
export class LocationServiceController implements ILocationServiceController {
  constructor(private readonly service: LocationServiceService) {}

  async findNearestDrivers(
    request: FindNearestDriversRequest,
  ): Promise<FindNearestDriversResponse> {
    const drivers = await this.service.findNearest(request);
    return { drivers };
  }

  async setDriverAvailability(
    request: SetDriverAvailabilityRequest,
  ): Promise<SetDriverAvailabilityResponse> {
    await this.service.setAvailability(request);
    return { ok: true };
  }

  async reserveNearestDriver(
    request: ReserveNearestDriverRequest,
  ): Promise<ReserveNearestDriverResponse> {
    return this.service.reserveNearest(request);
  }

  async releaseDriver(
    request: ReleaseDriverRequest,
  ): Promise<ReleaseDriverResponse> {
    return this.service.releaseDriver(request);
  }
}
