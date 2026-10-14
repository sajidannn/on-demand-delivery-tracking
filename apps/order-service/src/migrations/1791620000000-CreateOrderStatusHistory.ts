import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v1.2 — Riwayat Status Order
 *
 * Setiap perubahan status order dicatat di tabel ini secara atomik (via CTE),
 * bersamaan dengan UPDATE tabel orders. Tabel ini tidak pernah ditulis sendiri;
 * selalu lewat repository yang memakai pola CTE.
 *
 * Backfill: satu baris per order yang sudah ada, dengan reason='BACKFILL',
 * agar GET /orders/:id selalu mengembalikan array history yang tidak kosong.
 */
export class CreateOrderStatusHistory1791620000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Buat tabel
    await queryRunner.query(`
      CREATE TABLE order_status_history (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        from_status order_status NULL,
        to_status   order_status NOT NULL,
        actor_type  varchar(20) NOT NULL,
        actor_id    uuid NULL,
        reason      varchar(100) NULL,
        occurred_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 2. Index untuk query "ambil riwayat satu order berurutan"
    await queryRunner.query(`
      CREATE INDEX order_status_history_order_idx
        ON order_status_history (order_id, occurred_at);
    `);

    // 3. Backfill: satu baris per order yang sudah ada
    //    from_status NULL menandai ini adalah entri pertama (asal-mula)
    //    occurred_at = updated_at agar urutan waktu konsisten dengan data lama
    await queryRunner.query(`
      INSERT INTO order_status_history
        (order_id, from_status, to_status, actor_type, actor_id, reason, occurred_at)
      SELECT
        id,
        NULL,
        status,
        'SYSTEM',
        NULL,
        'BACKFILL',
        updated_at
      FROM orders;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS order_status_history_order_idx;`);
    await queryRunner.query(`DROP TABLE IF EXISTS order_status_history;`);
  }
}
