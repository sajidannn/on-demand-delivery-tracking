import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@app/common';

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
  ): Promise<OrderRow> {
    const fee = Number(this.configService.get('FLAT_FEE', 10000));

    const result = await this.dataSource.query(
      `WITH inserted AS (
         INSERT INTO orders (
           customer_id, pickup, dropoff, distance_m, fee
         )
         VALUES (
           $1::uuid,
           ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
           ROUND(ST_Distance(
             ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
             ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography
           )),
           $6
         )
         RETURNING *
       )
       SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng
       FROM inserted;`,
      [customerId, pickupLat, pickupLng, dropoffLat, dropoffLng, fee],
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows[0] as OrderRow;
  }

  async findById(orderId: string): Promise<OrderRow | null> {
    const rows = await this.dataSource.query(
      `SELECT id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
              ST_Y(pickup::geometry) AS pickup_lat, ST_X(pickup::geometry) AS pickup_lng,
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng
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
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng
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
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng
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
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng
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
              ST_Y(dropoff::geometry) AS dropoff_lat, ST_X(dropoff::geometry) AS dropoff_lng
       FROM updated;`,
      [orderId, status, oldStatus],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }
}
