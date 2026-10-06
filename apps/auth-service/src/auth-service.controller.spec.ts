import { Test, TestingModule } from '@nestjs/testing';
import { AuthServiceController } from './auth-service.controller.js';
import { AuthServiceService } from './auth-service.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Role } from '@app/common';

describe('AuthServiceController', () => {
  let controller: AuthServiceController;
  let service: AuthServiceService;

  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  const jwtMock = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthServiceController],
      providers: [
        AuthServiceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    controller = module.get<AuthServiceController>(AuthServiceController);
    service = module.get<AuthServiceService>(AuthServiceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should return user data on success', async () => {
      const fakeUser = {
        id: 'uuid-1',
        email: 'a@b.com',
        name: 'Budi',
        role: Role.CUSTOMER,
      };
      prismaMock.user.create.mockResolvedValue(fakeUser);

      const result = await service.register({
        email: 'a@b.com',
        password: 'password123',
        name: 'Budi',
        role: Role.CUSTOMER,
      });

      expect(result).toMatchObject({
        id: 'uuid-1',
        email: 'a@b.com',
        role: Role.CUSTOMER,
      });
    });

    it('should throw EMAIL_TAKEN when Prisma returns P2002', async () => {
      prismaMock.user.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.register({
          email: 'dup@b.com',
          password: 'pass123',
          name: 'X',
          role: Role.DRIVER,
        }),
      ).rejects.toThrow(RpcException);

      await expect(
        service.register({
          email: 'dup@b.com',
          password: 'pass123',
          name: 'X',
          role: Role.DRIVER,
        }),
      ).rejects.toMatchObject({ error: { code: 'EMAIL_TAKEN' } });
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('should throw UNAUTHORIZED when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@b.com', password: 'pass123' }),
      ).rejects.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('should throw UNAUTHORIZED on wrong password', async () => {
      // bcrypt.compare akan return false karena hash tidak cocok
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'a@b.com',
        passwordHash: 'wrong_hash_not_valid_bcrypt',
        role: Role.CUSTOMER,
      });

      await expect(
        service.login({ email: 'a@b.com', password: 'wrongpassword' }),
      ).rejects.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('should return access token on valid credentials', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('pass123', 1); // dummy hash fast
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'a@b.com',
        passwordHash: hash,
        role: Role.CUSTOMER,
      });
      jwtMock.signAsync.mockResolvedValue('fake_token_123');

      const result = await service.login({
        email: 'a@b.com',
        password: 'pass123',
      });
      expect(result).toEqual({ accessToken: 'fake_token_123' });
      expect(jwtMock.signAsync).toHaveBeenCalledWith({
        sub: 'uuid-1',
        role: Role.CUSTOMER,
      });
    });
  });

  // ── validateToken ──────────────────────────────────────────────────────────

  describe('validateToken', () => {
    it('should throw UNAUTHORIZED when jwt.verifyAsync throws', async () => {
      jwtMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.validateToken('invalid.token.here'),
      ).rejects.toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    });

    it('should return userId and role on valid token', async () => {
      jwtMock.verifyAsync.mockResolvedValue({
        sub: 'uuid-1',
        role: Role.DRIVER,
      });

      const result = await service.validateToken('valid.token.here');
      expect(result).toEqual({ userId: 'uuid-1', role: Role.DRIVER });
    });
  });

  // ── getMe ──────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('should throw NOT_FOUND when user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent-id')).rejects.toMatchObject({
        error: { code: 'NOT_FOUND' },
      });
    });

    it('should return user data when user exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'uuid-2',
        email: 'test@b.com',
        name: 'Test',
        role: Role.CUSTOMER,
        passwordHash: 'abc',
      });

      const result = await service.getMe('uuid-2');
      expect(result).toEqual({
        id: 'uuid-2',
        email: 'test@b.com',
        name: 'Test',
        role: Role.CUSTOMER,
      });
    });
  });
});
