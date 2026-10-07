import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module.js';
import { NOTIFICATION_QUEUE, getRmqOptions } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationServiceModule,
    getRmqOptions(
      process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
      NOTIFICATION_QUEUE,
    ),
  );
  await app.listen();
}
await bootstrap();
