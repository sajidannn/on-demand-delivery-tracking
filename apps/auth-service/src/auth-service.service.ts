import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma/prisma.service.js';
import { RegisterDto, LoginDto, Role as CommonRole } from '@app/common';

@Injectable()
export class AuthServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    try {
      const passwordHash = await bcrypt.hash(data.password, 10);

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          role: data.role,
        },
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as CommonRole,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new RpcException({
          code: 'EMAIL_TAKEN',
          message: 'Email sudah terdaftar',
        });
      }
      throw new RpcException({
        code: 'INTERNAL',
        message: 'Terjadi kesalahan saat register',
      });
    }
  }

  async login(data: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: data.email,
      },
    });

    if (!user) {
      throw new RpcException({
        code: 'UNAUTHORIZED',
        message: 'Krdensial tidak valid',
      });
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new RpcException({
        code: 'UNAUTHORIZED',
        message: 'Kredensial tidak valid',
      });
    }

    const payload = { sub: user.id, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async validateToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      return {
        userId: payload.sub,
        role: payload.role as CommonRole,
      };
    } catch (error) {
      throw new RpcException({
        code: 'UNAUTHORIZED',
        mesasge: 'Token tidak valid atau sudah kadaluwarsa',
      });
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new RpcException({
        code: 'NOT_FOUND',
        message: 'User tidak ditemukan',
      });
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as CommonRole,
    };
  }
}
