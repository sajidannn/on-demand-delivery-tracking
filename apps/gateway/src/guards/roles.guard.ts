import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@app/common';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Membaca label @Roles() yang dipasang di controller
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Jika tidak ada label @Roles, berarti rute ini bebas untuk semua role (yang sudah login)
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // Didapatkan dari JwtAuthGuard tadi

    if (!user) {
      throw new ForbiddenException('Akses ditolak');
    }

    // Cek apakah role user ada di dalam daftar role yang diizinkan
    const isRoleValid = requiredRoles.includes(user.role);
    if (!isRoleValid) {
      throw new ForbiddenException(
        `Akses khusus untuk role: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
