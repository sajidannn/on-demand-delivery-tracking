import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LOCATION_SERVICE_NAME } from '@app/common';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { OrderServiceController } from './order-service.controller.js';
import { OrderServiceService } from './order-service.service.js';
import { OrderRepository } from './order.repository.js';
import { OrderStateMachine } from './order-state-machine.service.js';
import { OrderEventsPublisher } from './order-events.publisher.js';
import {
  NOTIFICATION_CLIENT_TOKEN,
  GATEWAY_CLIENT_TOKEN,
  NOTIFICATION_QUEUE,
  GATEWAY_QUEUE,
  getRmqOptions,
} from '@app/common';

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('ORDER_DATABASE_URL'),
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
    ClientsModule.registerAsync([
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
      {
        name: NOTIFICATION_CLIENT_TOKEN,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          getRmqOptions(
            config.getOrThrow<string>('RABBITMQ_URL'),
            NOTIFICATION_QUEUE,
          ),
      },
      {
        name: GATEWAY_CLIENT_TOKEN,
        inject: [ConfigService],
        useFactory: (config: ConfigService) =>
          getRmqOptions(
            config.getOrThrow<string>('RABBITMQ_URL'),
            GATEWAY_QUEUE,
          ),
      },
    ]),
  ],
  controllers: [OrderServiceController],
  providers: [
    OrderServiceService,
    OrderRepository,
    OrderStateMachine,
    OrderEventsPublisher,
  ],
})
export class OrderServiceModule {}
