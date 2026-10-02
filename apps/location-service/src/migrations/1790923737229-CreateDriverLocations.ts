import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDriverLocations1790923737229 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE driver_locations (
                driver_id    uuid PRIMARY KEY,
                is_available boolean NOT NULL DEFAULT false,
                location     geography(Point,4326) NOT NULL,
                updated_at   timestamptz NOT NULL DEFAULT now()
            );
        `);
        await queryRunner.query(`
            CREATE INDEX driver_locations_gix ON driver_locations USING GIST (location);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX driver_locations_gix;`);
        await queryRunner.query(`DROP TABLE driver_locations;`);
    }
}
