import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrentOrderIdToDriverLocations1791234567000 implements MigrationInterface {
  name = 'AddCurrentOrderIdToDriverLocations1791234567000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE driver_locations ADD COLUMN current_order_id uuid NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX driver_locations_order_idx ON driver_locations (current_order_id) WHERE current_order_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX driver_locations_order_idx`);
    await queryRunner.query(
      `ALTER TABLE driver_locations DROP COLUMN current_order_id`,
    );
  }
}
