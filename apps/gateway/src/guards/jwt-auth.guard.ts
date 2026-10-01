import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { PATTERNS } from '@app/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token tidak ditemukan');
    }

    const token = authHeader.split(' ')[1];

    try {
      // Call Auth Service
      const user = await firstValueFrom(
        this.authClient.send(PATTERNS.AUTH.VALIDATE_TOKEN, { token }),
      );

      // Jika valid, simpan data user ke dalam object request agar bisa dibaca oleh Controller
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token tidak valid atau kadaluarsa');
    }
  }
}
