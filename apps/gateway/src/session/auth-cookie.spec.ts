import { maxAgeFromJwt, cookieOptions, setAuthCookie, clearAuthCookie } from './auth-cookie.js';
import { Response } from 'express';

describe('Auth Cookie Session', () => {
  const mockNow = 1600000000000;
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
    process.env.COOKIE_SAMESITE = 'lax';
    process.env.COOKIE_SECURE = 'true';
    process.env.AUTH_COOKIE_NAME = 'test_token';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('maxAgeFromJwt', () => {
    it('returns maxAge in ms based on exp claim', () => {
      // payload = { exp: 1600003600 } -> 3600s after mockNow
      const payload = Buffer.from(JSON.stringify({ exp: 1600003600 })).toString('base64url');
      const token = `header.${payload}.signature`;
      const maxAge = maxAgeFromJwt(token, mockNow);
      expect(maxAge).toBe(3600000);
    });

    it('returns 0 if token is invalid or exp is missing', () => {
      const payload = Buffer.from(JSON.stringify({})).toString('base64url');
      expect(maxAgeFromJwt(`header.${payload}.sig`, mockNow)).toBe(0);
      expect(maxAgeFromJwt('invalid-token', mockNow)).toBe(0);
    });
  });

  describe('cookieOptions', () => {
    it('generates options correctly', () => {
      const payload = Buffer.from(JSON.stringify({ exp: 1600003600 })).toString('base64url');
      const token = `header.${payload}.signature`;
      const opts = cookieOptions(token);
      expect(opts).toEqual({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: true,
        maxAge: 3600000,
      });
    });

    it('generates options without maxAge if token not provided', () => {
      const opts = cookieOptions();
      expect(opts.maxAge).toBeUndefined();
    });
  });

  describe('setAuthCookie', () => {
    it('sets cookie on response', () => {
      const res = { cookie: vi.fn() } as unknown as Response;
      const payload = Buffer.from(JSON.stringify({ exp: 1600003600 })).toString('base64url');
      const token = `header.${payload}.signature`;
      
      setAuthCookie(res, token);
      expect(res.cookie).toHaveBeenCalledWith('test_token', token, expect.objectContaining({
        httpOnly: true,
        path: '/',
        maxAge: 3600000,
      }));
    });
  });

  describe('clearAuthCookie', () => {
    it('clears cookie with same attributes', () => {
      const res = { clearCookie: vi.fn() } as unknown as Response;
      clearAuthCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith('test_token', {
        path: '/',
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      });
    });
  });
});
