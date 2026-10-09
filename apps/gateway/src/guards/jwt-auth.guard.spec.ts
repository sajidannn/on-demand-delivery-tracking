import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ExecutionContext, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { Request } from 'express';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let authClient: any;
  let context: any;
  let request: Request & { user?: unknown };

  beforeEach(() => {
    authClient = {
      send: vi.fn(),
    };
    
    guard = new JwtAuthGuard(authClient);
    
    request = {
      headers: {},
      cookies: {},
      method: 'GET',
    } as unknown as Request & { user?: unknown };

    context = {
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: () => request,
      }),
    };

    process.env.AUTH_COOKIE_NAME = 'access_token';
  });

  it('throws Unauthorized if no token provided', async () => {
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('validates Bearer token successfully', async () => {
    request.headers.authorization = 'Bearer token123';
    authClient.send.mockReturnValue(of({ userId: 'user1' }));
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.user).toEqual({ userId: 'user1' });
  });

  it('validates cookie token successfully for GET', async () => {
    request.cookies = { access_token: 'token123' };
    authClient.send.mockReturnValue(of({ userId: 'user1' }));
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws Forbidden for unsafe method with cookie token but no CSRF header', async () => {
    request.cookies = { access_token: 'token123' };
    request.method = 'POST';
    
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('validates cookie token for unsafe method with CSRF header', async () => {
    request.cookies = { access_token: 'token123' };
    request.method = 'POST';
    request.headers['x-requested-with'] = 'XMLHttpRequest';
    authClient.send.mockReturnValue(of({ userId: 'user1' }));
    
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws Unauthorized if auth service returns UNAUTHORIZED', async () => {
    request.headers.authorization = 'Bearer token123';
    authClient.send.mockReturnValue(throwError(() => ({ code: 'UNAUTHORIZED' })));
    
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
