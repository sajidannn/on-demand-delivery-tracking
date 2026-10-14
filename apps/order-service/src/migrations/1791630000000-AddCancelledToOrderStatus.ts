import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * v1.2 — Status Order CANCELLED (AC-30: Pembatalan Order oleh Customer)
 *
 * Menambahkan nilai 'CANCELLED' ke ENUM order_status.
 *
 * Catatan Postgres 16: `ALTER TYPE ... ADD VALUE` tidak boleh dijalankan di
 * dalam blok transaksi yang sama dengan penggunaan nilai barunya. Migrasi ini
 * sengaja dipisah dari migrasi lain dan hanya berisi DDL ini; TypeORM
 * migrationsRun memasukkan setiap migrasi dalam transaksinya sendiri, dan
 * karena tidak ada pemakaian nilai 'CANCELLED' di migrasi ini, aturan tersebut
 * terpenuhi.
 */
export class AddCancelledToOrderStatus1791630000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'CANCELLED';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres ENUM tidak mendukung penghapusan nilai secara langsung.
    // Untuk benar-benar melepas 'CANCELLED' diperlukan migrasi rekreasi tipe:
    // buat tipe baru tanpa nilai tersebut, ALTER COLUMN ... TYPE tipe_baru
    // USING ...::text::tipe_baru, lalu DROP TYPE lama. Tidak aman untuk
    // dilakukan otomatis, jadi down ini sengaja no-op.
  }
}
