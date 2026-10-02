import { Test, TestingModule } from '@nestjs/testing';
import { AuthServiceController } from './auth-service.controller.js';
import { AuthServiceService } from './auth-service.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { vi } from 'vitest';

describe('AuthServiceController', () => {
  let authServiceController: AuthServiceController;

  const prismaMock = { user: { findUnique: vi.fn(), create: vi.fn() } };
  const jwtMock = { signAsync: vi.fn(), verifyAsync: vi.fn() };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthServiceController],
      providers: [
        AuthServiceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    authServiceController = app.get<AuthServiceController>(AuthServiceController);
  });

  describe('root', () => {
    it('should be defined', () => {
      expect(authServiceController).toBeDefined();
    });
  });
});
