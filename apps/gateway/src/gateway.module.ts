import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayController } from './gateway.controller.js';
import { GatewayService } from './gateway.service.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
