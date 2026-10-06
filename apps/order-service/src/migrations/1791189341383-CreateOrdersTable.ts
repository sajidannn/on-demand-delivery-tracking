import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrdersTable1791189341383 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE order_status AS ENUM
             ('PENDING','DRIVER_ASSIGNED','PICKED_UP','COMPLETED','NO_DRIVER_AVAILABLE');

            CREATE TABLE orders (
              id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              customer_id uuid NOT NULL,
              driver_id   uuid NULL,
              status      order_status NOT NULL DEFAULT 'PENDING',
              pickup      geography(Point,4326) NOT NULL,
              dropoff     geography(Point,4326) NOT NULL,
              distance_m  integer NOT NULL,
              fee         integer NOT NULL,
              created_at  timestamptz NOT NULL DEFAULT now(),
              updated_at  timestamptz NOT NULL DEFAULT now()
            );
            CREATE INDEX orders_customer_idx ON orders (customer_id);
            CREATE INDEX orders_driver_idx ON orders (driver_id);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TABLE orders;
            DROP TYPE order_status;
        `);
  }
}
