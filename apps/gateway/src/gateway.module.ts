import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';
import { AuthController } from './auth.controller.js';
import { LOCATION_SERVICE_NAME } from '@app/common';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { DriverController } from './driver.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDist = __dirname.includes('dist');
const locationProtoPath = isDist
  ? join(__dirname, 'location.proto')
  : join(__dirname, '../../../libs/common/src/proto/location.proto');


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
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
  controllers: [GatewayController, AuthController, DriverController],
  providers: [GatewayService],
})
export class GatewayModule {}
