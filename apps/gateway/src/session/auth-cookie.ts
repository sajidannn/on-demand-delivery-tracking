import { CookieOptions, Response } from 'express';

const VALID_SAMESITE = ['lax', 'strict', 'none'] as const;
type SameSiteValue = (typeof VALID_SAMESITE)[number];

/**
 * Validasi konfigurasi cookie saat boot.
 * Lempar Error agar gateway gagal start bila config tidak valid.
 * Panggil sekali dari main.ts sebelum app.listen().
 */
export function validateCookieConfig(): void {
  const sameSite = process.env.COOKIE_SAMESITE || 'lax';
  if (!VALID_SAMESITE.includes(sameSite as SameSiteValue)) {
    throw new Error(
      `COOKIE_SAMESITE tidak valid: "${sameSite}". Nilai yang diizinkan: lax, strict, none.`,
    );
  }
  if (sameSite === 'none' && process.env.COOKIE_SECURE !== 'true') {
    throw new Error(
      'COOKIE_SAMESITE=none mewajibkan COOKIE_SECURE=true (cookie SameSite=None harus dikirim lewat HTTPS).',
    );
  }
}

export function maxAgeFromJwt(token: string, nowMs = Date.now()): number {
  const payload = token.split('.')[1] ?? '';
  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  try {
    const { exp } = JSON.parse(decoded) as { exp?: number };
    return exp ? Math.max(0, exp * 1000 - nowMs) : 0;
  } catch (e) {
    return 0;
  }
}

export function cookieOptions(token?: string): CookieOptions {
  const raw = process.env.COOKIE_SAMESITE || 'lax';
  const sameSite = (VALID_SAMESITE.includes(raw as SameSiteValue) ? raw : 'lax') as SameSiteValue;
  const secure = process.env.COOKIE_SECURE === 'true';
  const maxAge = token ? maxAgeFromJwt(token) : 0;

  return {
    httpOnly: true,
    path: '/',
    sameSite,
    secure,
    maxAge: maxAge > 0 ? maxAge : undefined,
  };
}

export function setAuthCookie(res: Response, token: string) {
  const cookieName = process.env.AUTH_COOKIE_NAME || 'access_token';
  res.cookie(cookieName, token, cookieOptions(token));
}

export function clearAuthCookie(res: Response) {
  const cookieName = process.env.AUTH_COOKIE_NAME || 'access_token';
  const opts = cookieOptions();
  res.clearCookie(cookieName, {
    path: opts.path,
    sameSite: opts.sameSite,
    secure: opts.secure,
    httpOnly: opts.httpOnly,
  });
}
