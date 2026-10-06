import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';
import { AuthController } from './auth.controller.js';
import {
  AUTH_SERVICE_TOKEN,
  LOCATION_SERVICE_NAME,
  ORDER_SERVICE_TOKEN,
} from '@app/common';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { DriverController } from './driver.controller.js';
import { OrderController } from './order.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Cari proto di dist/ dulu (setelah build), fallback ke source saat dev
const distProtoPath = join(__dirname, 'location.proto');
const devProtoPath = join(
  __dirname,
  '../../../libs/common/src/proto/location.proto',
);
const locationProtoPath = existsSync(distProtoPath)
  ? distProtoPath
  : devProtoPath;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.registerAsync([
      {
        name: AUTH_SERVICE_TOKEN,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('AUTH_HOST', 'localhost'),
            port: config.get<number>('AUTH_PORT', 4001),
          },
        }),
      },
      {
        name: ORDER_SERVICE_TOKEN,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host: config.get('ORDER_HOST', 'localhost'),
            port: config.get<number>('ORDER_PORT', 4002),
          },
        }),
      },
      {
        name: LOCATION_SERVICE_NAME,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'location',
            protoPath: locationProtoPath,
            url: config.get('LOCATION_GRPC_URL', 'localhost:50051'),
          },
        }),
      },
    ]),
  ],
  controllers: [
    GatewayController,
    AuthController,
    DriverController,
    OrderController,
  ],
  providers: [GatewayService],
})
export class GatewayModule {}
