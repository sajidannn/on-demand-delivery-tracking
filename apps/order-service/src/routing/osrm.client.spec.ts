import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OsrmClient } from './osrm.client.js';
import { ConfigService } from '@nestjs/config';

describe('OsrmClient', () => {
  let client: OsrmClient;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: vi.fn((key: string, def: string) => def),
    } as any;
    client = new OsrmClient(configService);
    global.fetch = vi.fn();
  });

  it('1: Sukses mengembalikan rute valid', async () => {
    const mockResponse = {
      code: 'Ok',
      routes: [
        {
          distance: 1500.5,
          duration: 300,
          geometry: {
            type: 'LineString',
            coordinates: [[107.1, -6.1], [107.2, -6.2]],
          },
        },
      ],
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await client.getRoute({ lat: -6.1, lng: 107.1 }, { lat: -6.2, lng: 107.2 });
    expect(result).not.toBeNull();
    expect(result?.distanceM).toBe(1500.5);
    expect(result?.durationS).toBe(300);
    expect(result?.route.coordinates).toHaveLength(2);
  });

  it('2: Mengembalikan null bila NoRoute', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'NoRoute' }),
    } as any);

    const result = await client.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result).toBeNull();
  });

  it('3: Mengembalikan null bila non-200', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as any);

    const result = await client.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result).toBeNull();
  });

  it('4: Mengembalikan null bila JSON rusak / fetch throw error', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));
    
    const result = await client.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result).toBeNull();
  });

  it('5: Mengembalikan null bila geometri kurang dari 2 titik', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 10, duration: 10, geometry: { type: 'LineString', coordinates: [[107, -6]] } }]
      }),
    } as any);

    const result = await client.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result).toBeNull();
  });

  it('6: Timeout menghasilkan null', async () => {
    vi.mocked(global.fetch).mockImplementationOnce(async () => {
      throw new Error('TimeoutError');
    });

    const result = await client.getRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 });
    expect(result).toBeNull();
  });
});
