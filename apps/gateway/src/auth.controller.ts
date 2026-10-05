import {
  Req,
  UseGuards,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  AUTH_SERVICE_TOKEN,
  PATTERNS,
  RegisterDto,
  LoginDto,
  Role,
} from '@app/common';

/** Shape user yang disimpan di request setelah JwtAuthGuard */
interface AuthenticatedRequest {
  user: { userId: string; role: Role };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_SERVICE_TOKEN) private readonly authClient: ClientProxy,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Mendaftarkan user baru (Customer/Driver)' })
  @ApiResponse({
    status: 201,
    description:
      'User berhasil didaftarkan — mengembalikan {id, email, name, role}',
  })
  @ApiResponse({
    status: 400,
    description: 'Validasi gagal (VALIDATION_ERROR)',
  })
  @ApiResponse({
    status: 409,
    description: 'Email sudah terdaftar (EMAIL_TAKEN)',
  })
  async register(@Body() data: RegisterDto) {
    return firstValueFrom(
      this.authClient.send(PATTERNS.AUTH.REGISTER, data).pipe(timeout(5000)),
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login dan dapatkan JWT access token' })
  @ApiResponse({
    status: 200,
    description: 'Berhasil login — mengembalikan {accessToken}',
  })
  @ApiResponse({
    status: 400,
    description: 'Validasi gagal (VALIDATION_ERROR)',
  })
  @ApiResponse({
    status: 401,
    description: 'Kredensial tidak valid (UNAUTHORIZED)',
  })
  async login(@Body() data: LoginDto) {
    return firstValueFrom(
      this.authClient.send(PATTERNS.AUTH.LOGIN, data).pipe(timeout(5000)),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dapatkan profil user saat ini (semua role yang sudah login)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Profil berhasil diambil — mengembalikan {id, email, name, role}',
  })
  @ApiResponse({
    status: 401,
    description: 'Token tidak ada atau tidak valid (UNAUTHORIZED)',
  })
  @ApiResponse({
    status: 503,
    description: 'Auth service tidak tersedia (SERVICE_UNAVAILABLE)',
  })
  async getMe(@Req() req: AuthenticatedRequest) {
    const { userId } = req.user;
    return firstValueFrom(
      this.authClient.send(PATTERNS.AUTH.ME, { userId }).pipe(timeout(5000)),
    ).catch(() => {
      throw new ServiceUnavailableException('Auth service tidak tersedia');
    });
  }
}
