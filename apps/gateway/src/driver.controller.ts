import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ClientGrpc } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { firstValueFrom } from 'rxjs';
import {
  Role,
  DriverLocationDto,
  LOCATION_SERVICE_NAME,
  LocationServiceClient,
} from '@app/common';
import { Roles } from './decorators/roles.decorator.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DRIVER)
@Controller('drivers')
export class DriverController implements OnModuleInit {
  private locationService: LocationServiceClient;

  constructor(@Inject(LOCATION_SERVICE_NAME) private client: ClientGrpc) {}

  onModuleInit() {
    this.locationService = this.client.getService<LocationServiceClient>(
      LOCATION_SERVICE_NAME,
    );
  }

  @Post('online')
  @ApiOperation({ summary: 'Set driver availability to online' })
  @ApiResponse({ status: 200, description: 'Success setting online' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async setOnline(@Req() req: any, @Body() body: DriverLocationDto) {
    const driverId = req.user.userId;
    const response = await firstValueFrom(
      this.locationService.setDriverAvailability(
        {
          driverId,
          isAvailable: true,
          lat: body.lat,
          lng: body.lng,
        },
        new Metadata(),
      ),
    );
    return response;
  }

  @Post('offline')
  @ApiOperation({ summary: 'Set driver availability to offline' })
  @ApiResponse({ status: 200, description: 'Success setting offline' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async setOffline(@Req() req: any) {
    const driverId = req.user.userId;
    const response = await firstValueFrom(
      this.locationService.setDriverAvailability(
        {
          driverId,
          isAvailable: false,
          lat: 0,
          lng: 0,
        },
        new Metadata(),
      ),
    );
    return response;
  }
}
