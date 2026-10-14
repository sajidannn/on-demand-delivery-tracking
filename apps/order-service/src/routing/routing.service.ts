import { Injectable, Logger } from '@nestjs/common';
import { OsrmClient } from './osrm.client.js';
import { OrderRepository } from '../order.repository.js';
import { RouteSource, RouteGeometryDto } from '@app/common';

/**
 * Hitung jarak garis lurus antara dua koordinat menggunakan rumus Haversine.
 * Hasilnya dalam meter. Murni komputasi in-memory, tanpa round-trip ke DB atau OSRM.
 * Cocok sebagai pre-validasi cepat sebelum memanggil routing engine eksternal.
 */
export function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // radius bumi dalam meter
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
