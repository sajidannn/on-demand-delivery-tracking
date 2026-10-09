import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, RouteSource } from '@app/common';

export interface OrderRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: OrderStatus;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_m: number;
  fee: number;
  route_source: RouteSource;
  route?: any;
  duration_s: number | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class OrderRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async createOrder(
    customerId: string,
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    distanceM: number,
    fee: number,
    routeSource: RouteSource,
    route: any | null,
    durationS: number | null,
  ): Promise<OrderRow> {
    const routeJson = route ? JSON.stringify(route) : null;
    const result = await this.dataSource.query(
      `WITH inserted AS (
         INSERT INTO orders (
           customer_id, pickup, dropoff, distance_m, fee, route_source, route, duration_s
         )
         VALUES (
           $1::uuid,
           ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
           $6,
           $7,
           $8,
           CASE WHEN $9::text IS NOT NULL THEN ST_GeomFromGeoJSON($9::text)::geography ELSE NULL END,
           $10
         )
         RETURNING *
       )
       SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
              route_source,
              duration_s,
              CASE WHEN route IS NOT NULL THEN ST_AsGeoJSON(route::geometry)::json ELSE NULL END as route
       FROM inserted;`,
      [customerId, pickupLat, pickupLng, dropoffLat, dropoffLng, distanceM, fee, routeSource, routeJson, durationS],
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows[0] as OrderRow;
  }

  async findById(orderId: string): Promise<OrderRow | null> {
    const rows = await this.dataSource.query(
      `SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
              route_source, duration_s, CASE WHEN route IS NOT NULL THEN ST_AsGeoJSON(route::geometry)::json ELSE NULL END as route
       FROM orders
       WHERE id = $1::uuid;`,
      [orderId],
    );
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }

  async findByCustomerId(customerId: string): Promise<OrderRow[]> {
    const rows = await this.dataSource.query(
      `SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
              route_source, duration_s
       FROM orders
       WHERE customer_id = $1::uuid
       ORDER BY created_at DESC;`,
      [customerId],
    );
    return rows as OrderRow[];
  }

  async findByDriverId(driverId: string): Promise<OrderRow[]> {
    const rows = await this.dataSource.query(
      `SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
              route_source, duration_s
       FROM orders
       WHERE driver_id = $1::uuid
       ORDER BY created_at DESC;`,
      [driverId],
    );
    return rows as OrderRow[];
  }

  async updateDriverAndStatus(
    orderId: string,
    driverId: string | null,
    status: OrderStatus,
    oldStatus: OrderStatus,
  ): Promise<OrderRow | null> {
    const result = await this.dataSource.query(
      `WITH updated AS (
         UPDATE orders
         SET driver_id = $2::uuid, status = $3::order_status, updated_at = now()
         WHERE id = $1::uuid AND status = $4::order_status
         RETURNING *
       )
       SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
              route_source, duration_s, CASE WHEN route IS NOT NULL THEN ST_AsGeoJSON(route::geometry)::json ELSE NULL END as route
       FROM updated;`,
      [orderId, driverId, status, oldStatus],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    oldStatus: OrderStatus,
  ): Promise<OrderRow | null> {
    const result = await this.dataSource.query(
      `WITH updated AS (
         UPDATE orders
         SET status = $2::order_status, updated_at = now()
         WHERE id = $1::uuid AND status = $3::order_status
         RETURNING *
       )
       SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng,
              route_source, duration_s, CASE WHEN route IS NOT NULL THEN ST_AsGeoJSON(route::geometry)::json ELSE NULL END as route
       FROM updated;`,
      [orderId, status, oldStatus],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }

  async getStraightLineDistance(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT ROUND(ST_Distance(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      )) AS dist`,
      [pickup.lng, pickup.lat, dropoff.lng, dropoff.lat]
    );
    return Number(result[0].dist);
  }
}
