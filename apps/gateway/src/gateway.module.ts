import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';
import { AuthController } from './auth.controller.js';

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
            host: config.get('AUTH_HOST') || '0.0.0.0',
            port: Number(config.get('AUTH_PORT')) || 4001,
          },
        }),
      },
    ]),
  ],
  controllers: [GatewayController, AuthController],
  providers: [GatewayService],
})
export class GatewayModule {}
