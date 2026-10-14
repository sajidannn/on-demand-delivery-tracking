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
  occurred_at?: Date;
}

export interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_type: 'SYSTEM' | 'CUSTOMER' | 'DRIVER';
  actor_id: string | null;
  reason: string | null;
  occurred_at: Date;
}

/** Kolom SELECT standar untuk tabel orders (tanpa route — dipakai di list). */
const ORDER_COLS = `
  id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
  ST_Y(pickup::geometry)  AS pickup_lat,
  ST_X(pickup::geometry)  AS pickup_lng,
  ST_Y(dropoff::geometry) AS dropoff_lat,
  ST_X(dropoff::geometry) AS dropoff_lng,
  route_source, duration_s
`;

/** Kolom SELECT standar untuk tabel orders (dengan route — dipakai di detail). */
const ORDER_COLS_WITH_ROUTE = `
  id, customer_id, driver_id, status, distance_m, fee, created_at, updated_at,
  ST_Y(pickup::geometry)  AS pickup_lat,
  ST_X(pickup::geometry)  AS pickup_lng,
  ST_Y(dropoff::geometry) AS dropoff_lat,
  ST_X(dropoff::geometry) AS dropoff_lng,
  route_source, duration_s,
  CASE WHEN route IS NOT NULL THEN ST_AsGeoJSON(route::geometry)::json ELSE NULL END AS route
`;

@Injectable()
export class OrderRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Membuat order baru dan langsung menulis baris riwayat NULL → PENDING
   * dalam satu CTE atomik. Mengembalikan row order beserta occurred_at dari riwayat.
   */
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
      `WITH ins AS (
         INSERT INTO orders (
           customer_id, pickup, dropoff, distance_m, fee, route_source, route, duration_s
         )
         VALUES (
           $1::uuid,
           ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
           $6, $7, $8,
           CASE WHEN $9::text IS NOT NULL THEN ST_GeomFromGeoJSON($9::text)::geography ELSE NULL END,
           $10
         )
         RETURNING *
       ),
       hist AS (
         INSERT INTO order_status_history
           (order_id, from_status, to_status, actor_type, actor_id, reason)
         SELECT id, NULL, status, 'CUSTOMER', $1::uuid, NULL
         FROM ins
         RETURNING occurred_at
       )
       SELECT ${ORDER_COLS_WITH_ROUTE.trim()}, hist.occurred_at
       FROM ins, hist;`,
      [
        customerId,
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        distanceM,
        fee,
        routeSource,
        routeJson,
        durationS,
      ],
    );

    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows[0] as OrderRow;
  }

  /** Mencari order berdasarkan ID, memuat kolom route. */
  async findById(orderId: string): Promise<OrderRow | null> {
    const rows = await this.dataSource.query(
      `SELECT ${ORDER_COLS_WITH_ROUTE.trim()}
       FROM orders
       WHERE id = $1::uuid;`,
      [orderId],
    );
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }

  /** Mencari semua order milik customer (tanpa kolom route untuk efisiensi). */
  async findByCustomerId(customerId: string): Promise<OrderRow[]> {
    const rows = await this.dataSource.query(
      `SELECT ${ORDER_COLS.trim()}
       FROM orders
       WHERE customer_id = $1::uuid
       ORDER BY created_at DESC;`,
      [customerId],
    );
    return rows as OrderRow[];
  }

  /** Mencari semua order yang pernah dikerjakan driver (tanpa kolom route). */
  async findByDriverId(driverId: string): Promise<OrderRow[]> {
    const rows = await this.dataSource.query(
      `SELECT ${ORDER_COLS.trim()}
       FROM orders
       WHERE driver_id = $1::uuid
       ORDER BY created_at DESC;`,
      [driverId],
    );
    return rows as OrderRow[];
  }

  /**
   * Update status dan driver_id sekaligus, plus tulis riwayat — satu CTE atomik.
   * Mengembalikan null jika kondisi WHERE (status lama) tidak terpenuhi,
   * yang berarti transisi gagal karena race condition atau status sudah berubah.
   */
  async updateDriverAndStatus(
    orderId: string,
    driverId: string | null,
    newStatus: OrderStatus,
    expectedOldStatus: OrderStatus,
    actorType: 'SYSTEM' | 'CUSTOMER' | 'DRIVER' = 'SYSTEM',
    actorId: string | null = null,
    reason: string | null = null,
  ): Promise<OrderRow | null> {
    const result = await this.dataSource.query(
      `WITH upd AS (
         UPDATE orders
         SET driver_id = $2::uuid, status = $3::order_status, updated_at = now()
         WHERE id = $1::uuid AND status = $4::order_status
         RETURNING *
       ),
       hist AS (
         INSERT INTO order_status_history
           (order_id, from_status, to_status, actor_type, actor_id, reason)
         SELECT id, $4::order_status, status, $5, $6::uuid, $7
         FROM upd
         RETURNING occurred_at
       )
       SELECT ${ORDER_COLS_WITH_ROUTE.trim()}, hist.occurred_at
       FROM upd, hist;`,
      [
        orderId,
        driverId,
        newStatus,
        expectedOldStatus,
        actorType,
        actorId,
        reason,
      ],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }

  /**
   * Update status order saja (tanpa mengubah driver_id), plus tulis riwayat.
   * Mengembalikan null jika kondisi tidak terpenuhi (race condition).
   */
  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    expectedOldStatus: OrderStatus,
    actorType: 'SYSTEM' | 'CUSTOMER' | 'DRIVER' = 'SYSTEM',
    actorId: string | null = null,
    reason: string | null = null,
  ): Promise<OrderRow | null> {
    const result = await this.dataSource.query(
      `WITH upd AS (
         UPDATE orders
         SET status = $2::order_status, updated_at = now()
         WHERE id = $1::uuid AND status = $3::order_status
         RETURNING *
       ),
       hist AS (
         INSERT INTO order_status_history
           (order_id, from_status, to_status, actor_type, actor_id, reason)
         SELECT id, $3::order_status, status, $4, $5::uuid, $6
         FROM upd
         RETURNING occurred_at
       )
       SELECT ${ORDER_COLS_WITH_ROUTE.trim()}, hist.occurred_at
       FROM upd, hist;`,
      [orderId, newStatus, expectedOldStatus, actorType, actorId, reason],
    );
    const rows = Array.isArray(result[0]) ? result[0] : result;
    return rows.length > 0 ? (rows[0] as OrderRow) : null;
  }

  /**
   * Ambil riwayat status order berurutan dari awal hingga sekarang.
   * Digunakan oleh GET /orders/:id untuk menampilkan timeline.
   */
  async findHistoryByOrderId(
    orderId: string,
  ): Promise<OrderStatusHistoryRow[]> {
    const rows = await this.dataSource.query(
      `SELECT id, order_id, from_status, to_status, actor_type, actor_id, reason, occurred_at
       FROM order_status_history
       WHERE order_id = $1::uuid
       ORDER BY occurred_at ASC;`,
      [orderId],
    );
    return rows as OrderStatusHistoryRow[];
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
      [pickup.lng, pickup.lat, dropoff.lng, dropoff.lat],
    );
    return Number(result[0].dist);
  }
}
