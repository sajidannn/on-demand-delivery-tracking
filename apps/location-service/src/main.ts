import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { LocationServiceModule } from './location-service.module.js';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { getRmqOptions, LOCATION_QUEUE } from '@app/common';

async function bootstrap() {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Cari proto di dist/ dulu (setelah build), fallback ke source saat dev
  // Lebih aman dari includes('dist') yang bisa false-positive jika nama folder mengandung 'dist'
  const distProto = join(__dirname, 'location.proto');
  const devProto = join(
    __dirname,
    '../../../libs/common/src/proto/location.proto',
  );
  const protoPath = existsSync(distProto) ? distProto : devProto;

  const app = await NestFactory.create(LocationServiceModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'location',
      protoPath,
      url: process.env.LOCATION_GRPC_URL || '0.0.0.0:50051',
    },
  });

  app.connectMicroservice<MicroserviceOptions>(
    getRmqOptions(
      process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
      LOCATION_QUEUE,
    ),
  );

  await app.startAllMicroservices();
  // Location service doesn't really need HTTP, but create() makes an HTTP server.
  // We can just initialize it to keep the process alive for gRPC and RMQ.
  await app.init();
}
await bootstrap();
