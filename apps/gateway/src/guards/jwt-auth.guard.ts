import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AUTH_SERVICE_TOKEN, PATTERNS, callService } from '@app/common';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SERVICE_TOKEN) private readonly authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string>; user: unknown }>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token tidak ditemukan');
    }

    const token = authHeader.split(' ')[1];

    try {
      request.user = await firstValueFrom(
        callService(
          this.authClient.send(PATTERNS.AUTH.VALIDATE_TOKEN, { token }),
          'auth-service',
          3000,
        ),
      );
      return true;
    } catch (error) {
      // Bedakan: token invalid vs auth-service tidak tersedia / down
      const err = error as { code?: string; name?: string; message?: string };
      if (err.code === 'UNAUTHORIZED') {
        throw new UnauthorizedException('Token tidak valid atau kadaluarsa');
      }
      if (err.code === 'SERVICE_UNAVAILABLE' && err.message) {
        throw new ServiceUnavailableException(err.message);
      }
      throw new ServiceUnavailableException('Layanan auth-service sedang down');
    }
  }
}
