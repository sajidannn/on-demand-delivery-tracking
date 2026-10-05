import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AUTH_SERVICE_TOKEN, PATTERNS } from '@app/common';

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
        this.authClient
          .send(PATTERNS.AUTH.VALIDATE_TOKEN, { token })
          .pipe(timeout(3000)),
      );
      return true;
    } catch (error) {
      // Bedakan: token invalid vs auth-service tidak tersedia / down
      const err = error as { code?: string; name?: string };
      if (err.code === 'UNAUTHORIZED') {
        throw new UnauthorizedException('Token tidak valid atau kadaluarsa');
      }
      throw new ServiceUnavailableException('Auth service tidak tersedia');
    }
  }
}
