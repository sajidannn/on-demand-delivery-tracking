import { Request } from 'express';

export type TokenSource = { token: string; source: 'header' | 'cookie' };

export function extractToken(req: Request): TokenSource | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { token: authHeader.substring(7), source: 'header' };
  }

  const cookieName = process.env.AUTH_COOKIE_NAME || 'access_token';
  const cookieToken = req.cookies?.[cookieName];
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }

  return null;
}
