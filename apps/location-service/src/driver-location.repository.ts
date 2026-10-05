import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

interface NearestDriverRow {
  driver_id: string;
  distance_m: number;
  lat: number;
  lng: number;
}

@Injectable()
export class DriverLocationRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  private getStaleSeconds(): number {
    return this.configService.get<number>('DRIVER_STALE_SECONDS', 60);
  }

  findNearest(lng: number, lat: number, radiusM: number, limit: number) {
    return this.dataSource.query<NearestDriverRow[]>(
      `SELECT driver_id,
              ST_Distance(location, p.pt) AS distance_m,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM driver_locations,
            (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS pt) p
       WHERE is_available = true
         AND current_order_id IS NULL
         AND updated_at > now() - make_interval(secs => $5::double precision)
         AND ST_DWithin(location, p.pt, $3)
       ORDER BY location <-> p.pt
       LIMIT $4`,
      [lng, lat, radiusM, limit, this.getStaleSeconds()],
    );
  }

  async reserveNearest(
    orderId: string,
    lng: number,
    lat: number,
    radiusM: number,
  ) {
    const rows = await this.dataSource.query<NearestDriverRow[]>(
      `WITH p AS (SELECT ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography AS pt),
       picked AS (
         SELECT d.driver_id
         FROM driver_locations d, p
         WHERE d.is_available = true
           AND d.current_order_id IS NULL
           AND d.updated_at > now() - make_interval(secs => $5::double precision)
           AND ST_DWithin(d.location, p.pt, $4)
         ORDER BY d.location <-> p.pt
         LIMIT 1
         FOR UPDATE OF d SKIP LOCKED
       )
       UPDATE driver_locations dl
       SET current_order_id = $1::uuid
       FROM picked, p
       WHERE dl.driver_id = picked.driver_id
       RETURNING dl.driver_id,
                 ST_Distance(dl.location, p.pt) AS distance_m,
                 ST_Y(dl.location::geometry) AS lat,
                 ST_X(dl.location::geometry) AS lng;`,
      [orderId, lng, lat, radiusM, this.getStaleSeconds()],
    );
    const returnedRows = Array.isArray(rows[0]) ? rows[0] : rows;
    return returnedRows.length > 0 ? returnedRows[0] : null;
  }

  async releaseByOrder(orderId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `UPDATE driver_locations SET current_order_id = NULL
       WHERE current_order_id = $1::uuid
       RETURNING driver_id;`,
      [orderId],
    );
    return rows.length > 0;
  }

  async markOnline(driverId: string, lng: number, lat: number): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO driver_locations (driver_id, is_available, location)
       VALUES ($1, true, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)
       ON CONFLICT (driver_id) DO UPDATE
       SET is_available = true, location = EXCLUDED.location, updated_at = now()`,
      [driverId, lng, lat],
    );
  }

  async markOffline(driverId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE driver_locations SET is_available = false, updated_at = now()
       WHERE driver_id = $1`,
      [driverId],
    );
  }
}
