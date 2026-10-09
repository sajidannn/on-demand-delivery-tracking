import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RoutingService } from './routing.service.js';
import { RouteSource } from '@app/common';

describe('RoutingService', () => {
  let routingService: RoutingService;
  let mockOsrmClient: any;
  let mockOrderRepo: any;

  beforeEach(() => {
    mockOsrmClient = {
      getRoute: vi.fn(),
    };
    mockOrderRepo = {
      getStraightLineDistance: vi.fn(),
    };
    routingService = new RoutingService(mockOsrmClient, mockOrderRepo);
  });

  it('Menggunakan OSRM jika sukses', async () => {
    mockOsrmClient.getRoute.mockResolvedValueOnce({
      distanceM: 2000,
      durationS: 300,
      route: { type: 'LineString', coordinates: [[0,0], [1,1]] }
    });

    const result = await routingService.getRouteEstimate({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result.distanceM).toBe(2000);
    expect(result.durationS).toBe(300);
    expect(result.routeSource).toBe(RouteSource.OSRM);
    expect(result.route).not.toBeNull();
  });

  it('Fallback ke STRAIGHT_LINE jika OSRM gagal/null', async () => {
    mockOsrmClient.getRoute.mockResolvedValueOnce(null);
    mockOrderRepo.getStraightLineDistance.mockResolvedValueOnce(1500);

    const result = await routingService.getRouteEstimate({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result.distanceM).toBe(1500);
    expect(result.durationS).toBeNull();
    expect(result.routeSource).toBe(RouteSource.STRAIGHT_LINE);
    expect(result.route).toBeNull();
  });
});
