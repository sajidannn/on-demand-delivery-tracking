import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationServiceController } from './location-service.controller.js';
import { LocationServiceService } from './location-service.service.js';
import { DriverLocationRepository } from './driver-location.repository.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('LOCATION_DATABASE_URL'),
        synchronize: false,
      }),
    }),
  ],
  controllers: [LocationServiceController],
  providers: [LocationServiceService, DriverLocationRepository],
})
export class LocationServiceModule {}
