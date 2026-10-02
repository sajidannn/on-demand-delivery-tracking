import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface NearestDriverRow {
  driver_id: string;
  distance_m: number;
  lat: number;
  lng: number;
}

@Injectable()
export class DriverLocationRepository {
  constructor(private readonly dataSource: DataSource) {}

  findNearest(lng: number, lat: number, radiusM: number, limit: number) {
    return this.dataSource.query<NearestDriverRow[]>(
      `SELECT driver_id,
              ST_Distance(location, p.pt) AS distance_m,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
       FROM driver_locations,
            (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS pt) p
       WHERE is_available = true
         AND updated_at > now() - interval '60 seconds'
         AND ST_DWithin(location, p.pt, $3)
       ORDER BY location <-> p.pt
       LIMIT $4`,
      [lng, lat, radiusM, limit],
    );
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
