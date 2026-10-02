import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { LocationServiceModule } from './location-service.module.js';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

async function bootstrap() {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Saat `nest build`: file ini ada di dist/apps/location-service/main.js
  //   → proto sudah disalin ke dist/apps/location-service/location.proto (oleh assets nest-cli)
  // Saat `start:dev` (ts-node/swc): file ini ada di apps/location-service/src/main.ts
  //   → proto ada di libs/common/src/proto/location.proto
  const isDist = __dirname.includes(`dist`);
  const protoPath = isDist
    ? join(__dirname, 'location.proto')
    : join(__dirname, '../../../libs/common/src/proto/location.proto');

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
