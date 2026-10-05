import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Inject,
  OnModuleInit,
  HttpCode,
  HttpStatus,
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

interface AuthenticatedRequest {
  user: { userId: string; role: Role };
}

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DRIVER)
@Controller('drivers')
export class DriverController implements OnModuleInit {
  private locationService!: LocationServiceClient;

  constructor(
    @Inject(LOCATION_SERVICE_NAME) private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.locationService = this.client.getService<LocationServiceClient>(
      LOCATION_SERVICE_NAME,
    );
  }

  @Post('online')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set driver online dengan lokasi awal' })
  @ApiResponse({
    status: 200,
    description: 'Driver berhasil online — mengembalikan {ok: true}',
  })
  @ApiResponse({
    status: 400,
    description: 'Validasi gagal (VALIDATION_ERROR)',
  })
  @ApiResponse({ status: 401, description: 'Token tidak valid (UNAUTHORIZED)' })
  @ApiResponse({ status: 403, description: 'Bukan role DRIVER (FORBIDDEN)' })
  async setOnline(
    @Req() req: AuthenticatedRequest,
    @Body() body: DriverLocationDto,
  ) {
    const { userId: driverId } = req.user;
    return firstValueFrom(
      this.locationService.setDriverAvailability(
        { driverId, isAvailable: true, lat: body.lat, lng: body.lng },
        new Metadata(),
      ),
    );
  }

  @Post('offline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set driver offline' })
  @ApiResponse({
    status: 200,
    description: 'Driver berhasil offline — mengembalikan {ok: true}',
  })
  @ApiResponse({ status: 401, description: 'Token tidak valid (UNAUTHORIZED)' })
  @ApiResponse({ status: 403, description: 'Bukan role DRIVER (FORBIDDEN)' })
  async setOffline(@Req() req: AuthenticatedRequest) {
    const { userId: driverId } = req.user;
    return firstValueFrom(
      this.locationService.setDriverAvailability(
        { driverId, isAvailable: false, lat: 0, lng: 0 },
        new Metadata(),
      ),
    );
  }
}
