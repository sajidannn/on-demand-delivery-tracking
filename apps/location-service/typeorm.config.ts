import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

export default new DataSource({
  type: 'postgres',
  url: process.env.LOCATION_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/location_db',
  entities: [],
  migrations: [join(import.meta.dirname, 'src/migrations/*{.ts,.js}')],
  synchronize: false,
});
