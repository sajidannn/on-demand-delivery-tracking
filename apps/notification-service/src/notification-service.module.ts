import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AUTH_SERVICE_TOKEN } from '@app/common';
import { NotificationServiceController } from './notification-service.controller.js';
import { NotificationServiceService } from './notification-service.service.js';
import { EmailService } from './email/email.service.js';

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
            host: config.get<string>('AUTH_HOST', 'localhost'),
            port: config.get<number>('AUTH_PORT', 4001),
          },
        }),
      },
    ]),
  ],
  controllers: [NotificationServiceController],
  providers: [NotificationServiceService, EmailService],
})
export class NotificationServiceModule {}
