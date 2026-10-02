import { Controller } from '@nestjs/common';
import {
  LocationServiceController as ILocationServiceController,
  LocationServiceControllerMethods,
  FindNearestDriversRequest,
  FindNearestDriversResponse,
  SetDriverAvailabilityRequest,
  SetDriverAvailabilityResponse,
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
}
