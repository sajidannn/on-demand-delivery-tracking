import { maxAgeFromJwt, cookieOptions, setAuthCookie, clearAuthCookie, validateCookieConfig } from './auth-cookie.js';
import { Response } from 'express';

describe('Auth Cookie Session', () => {
  const mockNow = 1600000000000;
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
    process.env.COOKIE_SAMESITE = 'lax';
    process.env.COOKIE_SECURE = 'false';
    process.env.AUTH_COOKIE_NAME = 'test_token';
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── validateCookieConfig ────────────────────────────────────────────────

  describe('validateCookieConfig', () => {
    it('lulus bila COOKIE_SAMESITE=lax', () => {
      process.env.COOKIE_SAMESITE = 'lax';
      expect(() => validateCookieConfig()).not.toThrow();
    });

    it('lulus bila COOKIE_SAMESITE=strict', () => {
      process.env.COOKIE_SAMESITE = 'strict';
      expect(() => validateCookieConfig()).not.toThrow();
    });

    it('lulus bila COOKIE_SAMESITE=none dan COOKIE_SECURE=true', () => {
      process.env.COOKIE_SAMESITE = 'none';
      process.env.COOKIE_SECURE = 'true';
      expect(() => validateCookieConfig()).not.toThrow();
    });

    it('gagal bila COOKIE_SAMESITE berisi nilai tidak valid', () => {
      process.env.COOKIE_SAMESITE = 'Lax'; // huruf besar, tidak valid
      expect(() => validateCookieConfig()).toThrow(/tidak valid/);
    });

    it('gagal bila COOKIE_SAMESITE=none tetapi COOKIE_SECURE bukan true', () => {
      process.env.COOKIE_SAMESITE = 'none';
      process.env.COOKIE_SECURE = 'false';
      expect(() => validateCookieConfig()).toThrow(/COOKIE_SECURE=true/);
    });
  });

  // ─── maxAgeFromJwt ───────────────────────────────────────────────────────

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

  // ─── cookieOptions ───────────────────────────────────────────────────────

  describe('cookieOptions', () => {
    it('generates correct options with all required attributes', () => {
      process.env.COOKIE_SAMESITE = 'lax';
      process.env.COOKIE_SECURE = 'false';
      const payload = Buffer.from(JSON.stringify({ exp: 1600003600 })).toString('base64url');
      const token = `header.${payload}.signature`;
      const opts = cookieOptions(token);
      // HttpOnly wajib ada (keamanan XSS)
      expect(opts.httpOnly).toBe(true);
      // path selalu /
      expect(opts.path).toBe('/');
      // sameSite dari env
      expect(opts.sameSite).toBe('lax');
      // secure dari env
      expect(opts.secure).toBe(false);
      // maxAge harus ada dan bernilai positif (penting untuk sesi berbatas waktu)
      expect(typeof opts.maxAge).toBe('number');
      expect(opts.maxAge).toBeGreaterThan(0);
      expect(opts.maxAge).toBe(3600000);
    });

    it('maxAge undefined bila token tidak disediakan', () => {
      const opts = cookieOptions();
      expect(opts.maxAge).toBeUndefined();
    });
  });

  // ─── setAuthCookie ───────────────────────────────────────────────────────

  describe('setAuthCookie', () => {
    it('sets cookie on response dengan nama dan atribut yang benar', () => {
      process.env.AUTH_COOKIE_NAME = 'test_token';
      const res = { cookie: vi.fn() } as unknown as Response;
      const payload = Buffer.from(JSON.stringify({ exp: 1600003600 })).toString('base64url');
      const token = `header.${payload}.signature`;
      
      setAuthCookie(res, token);

      // Pastikan nama cookie sesuai AUTH_COOKIE_NAME
      expect(res.cookie).toHaveBeenCalledWith(
        'test_token',
        token,
        expect.objectContaining({
          httpOnly: true,
          path: '/',
          maxAge: 3600000, // MaxAge harus terisi, bukan undefined
        }),
      );
    });
  });

  // ─── clearAuthCookie ─────────────────────────────────────────────────────

  describe('clearAuthCookie', () => {
    it('clears cookie dengan atribut yang identik dengan saat set (wajib untuk browser)', () => {
      process.env.COOKIE_SAMESITE = 'lax';
      process.env.COOKIE_SECURE = 'false';
      const res = { clearCookie: vi.fn() } as unknown as Response;
      clearAuthCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith('test_token', {
        path: '/',
        sameSite: 'lax',
        secure: false,
        httpOnly: true,
      });
    });
  });
});
