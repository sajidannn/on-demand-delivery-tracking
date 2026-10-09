import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouteGeometryDto } from '@app/common';

export interface OsrmRouteResult {
  distanceM: number;
  durationS: number;
  route: RouteGeometryDto;
}

@Injectable()
export class OsrmClient {
  private readonly logger = new Logger(OsrmClient.name);

  constructor(private readonly configService: ConfigService) {}

  async getRoute(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<OsrmRouteResult | null> {
    try {
      const baseUrl = this.configService.get<string>('OSRM_URL', 'http://router.project-osrm.org');
      const profile = this.configService.get<string>('OSRM_PROFILE', 'driving');
      const timeoutMs = parseInt(this.configService.get<string>('OSRM_TIMEOUT_MS', '3000'), 10);

      // OSRM requires lng,lat
      const coords = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
      const url = `${baseUrl}/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'UrbanSolv-DeliveryTracking/1.0',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(`OSRM returned non-200 status: ${response.status}`);
        return null;
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        this.logger.warn(`OSRM no route found or code not Ok: ${data.code}`);
        return null;
      }

      const route = data.routes[0];
      const geometry = route.geometry;

      if (!geometry || geometry.type !== 'LineString' || !geometry.coordinates || geometry.coordinates.length < 2) {
        this.logger.warn('OSRM returned invalid geometry (less than 2 points or not LineString)');
        return null;
      }

      return {
        distanceM: route.distance,
        durationS: route.duration,
        route: {
          type: 'LineString',
          coordinates: geometry.coordinates,
        },
      };
    } catch (e) {
      this.logger.warn(`OSRM request failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
}
