import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRouteToOrders1791529423775 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "duration_s" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "route_source" varchar(50) NOT NULL DEFAULT 'STRAIGHT_LINE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "route" geography(LineString,4326)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "route"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "route_source"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "duration_s"`);
  }

}
