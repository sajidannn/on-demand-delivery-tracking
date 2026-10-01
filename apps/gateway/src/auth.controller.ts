import { Req, UseGuards, Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { RolesGuard } from './guards/roles.guard.js';
import { Role } from '@app/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PATTERNS, RegisterDto, LoginDto } from '@app/common';

@ApiTags('Auth')
@Controller('auth') // Semua endpoint di dalam sini diawali dengan /auth
export class AuthController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Mendaftarkan user baru (Customer/Driver)' })
  @ApiResponse({ status: 201, description: 'User berhasil didaftarkan' })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar' })
  async register(@Body() data: RegisterDto) {
    // Mengirim pesan TCP 'auth.register' dan menunggu jawabannya
    return firstValueFrom(this.authClient.send(PATTERNS.AUTH.REGISTER, data));
  }

  @Post('login')
  @ApiOperation({ summary: 'Login dan dapatkan JWT token' })
  @ApiResponse({ status: 201, description: 'Berhasil login, mengembalikan accessToken' })
  @ApiResponse({ status: 401, description: 'Kredensial tidak valid' })
  async login(@Body() data: LoginDto) {
    return firstValueFrom(this.authClient.send(PATTERNS.AUTH.LOGIN, data));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dapatkan profil user saat ini (Hanya CUSTOMER)' })
  @ApiResponse({ status: 200, description: 'Profil berhasil diambil' })
  @ApiResponse({ status: 401, description: 'Token tidak valid' })
  @ApiResponse({ status: 403, description: 'Akses ditolak (bukan CUSTOMER)' })
  async getMe(@Req() req: any) {
    // Karena sudah melewati JwtAuthGuard, object `req.user` pasti ada isinya
    const user = req.user as { userId: string; role: string };

    return firstValueFrom(
      this.authClient.send(PATTERNS.AUTH.ME, { userId: user.userId }),
    );
  }
}
