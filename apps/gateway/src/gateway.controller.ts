import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GatewayService } from './gateway.service.js';

@ApiTags('System')
@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get()
  @ApiOperation({ summary: 'Get Hello' })
  @ApiResponse({ status: 200, description: 'Hello Message' })
  getHello(): string {
    return this.gatewayService.getHello();
  }
}
