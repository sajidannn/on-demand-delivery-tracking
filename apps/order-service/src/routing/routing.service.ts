import { Injectable, Logger } from '@nestjs/common';
import { OsrmClient } from './osrm.client.js';
import { OrderRepository } from '../order.repository.js';
import { RouteSource, RouteGeometryDto } from '@app/common';

export interface RouteEstimate {
  distanceM: number;
  durationS: number | null;
  routeSource: RouteSource;
  route: RouteGeometryDto | null;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    private readonly osrmClient: OsrmClient,
    private readonly orderRepo: OrderRepository,
  ) {}

  async getRouteEstimate(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<RouteEstimate> {
    const osrmResult = await this.osrmClient.getRoute(pickup, dropoff);

    if (osrmResult) {
      return {
        distanceM: Math.round(osrmResult.distanceM),
        durationS: osrmResult.durationS ? Math.round(osrmResult.durationS) : null,
        routeSource: RouteSource.OSRM,
        route: osrmResult.route,
      };
    }

    this.logger.warn('OSRM failed or returned null, falling back to straight line distance');

    const distanceM = await this.orderRepo.getStraightLineDistance(pickup, dropoff);

    return {
      distanceM: Math.round(distanceM),
      durationS: null,
      routeSource: RouteSource.STRAIGHT_LINE,
      route: null,
    };
  }
}
