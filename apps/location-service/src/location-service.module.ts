import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocationServiceController } from './location-service.controller.js';
import { LocationServiceService } from './location-service.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [LocationServiceController],
  providers: [LocationServiceService],
})
export class LocationServiceModule {}
