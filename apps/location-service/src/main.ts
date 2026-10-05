import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { LocationServiceModule } from './location-service.module.js';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

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

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    LocationServiceModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'location',
        protoPath,
        url: process.env.LOCATION_GRPC_URL || '0.0.0.0:50051',
      },
    },
  );
  await app.listen();
}
await bootstrap();
