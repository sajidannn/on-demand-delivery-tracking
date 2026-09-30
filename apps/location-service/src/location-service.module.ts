import { Module } from '@nestjs/common';
import { LocationServiceController } from './location-service.controller.js';
import { LocationServiceService } from './location-service.service.js';

@Module({
  imports: [],
  controllers: [LocationServiceController],
  providers: [LocationServiceService],
})
export class LocationServiceModule {}
