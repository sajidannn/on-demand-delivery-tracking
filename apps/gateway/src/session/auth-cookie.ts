import { CookieOptions, Response } from 'express';

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
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';
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
