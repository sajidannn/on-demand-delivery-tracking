import { NestFactory } from '@nestjs/core';
import { LocationServiceModule } from './location-service.module.js';

async function bootstrap() {
  const app = await NestFactory.create(LocationServiceModule);
  await app.listen(process.env.port ?? 3000);
}
await bootstrap();
