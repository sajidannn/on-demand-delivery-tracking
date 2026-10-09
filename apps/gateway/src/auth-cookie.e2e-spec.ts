import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { Role } from '@app/common';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'Passw0rd!';

interface ApiResult<T = Record<string, unknown>> {
  status: number;
  body: T;
  headers: Headers;
}

async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown; token?: string; cookie?: string; csrf?: boolean } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (init.token) headers['Authorization'] = `Bearer ${init.token}`;
  if (init.cookie) headers['Cookie'] = init.cookie;
  if (init.csrf) headers['X-Requested-With'] = 'XMLHttpRequest';

  const res = await fetch(BASE + path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body, headers: res.headers };
}

describe('Sesi Cookie & CSRF (e2e)', () => {
  const tag = `cookie-test-${Date.now()}`;
  const email = `${tag}@e2e.test`;
  let cookieHeaderStr = '';
  let rawToken = '';

  beforeAll(async () => {
    const health = await fetch(`${BASE}/health`).catch(() => null);
    if (!health?.ok) {
      throw new Error(`Gateway tidak terjangkau di ${BASE}. Jalankan docker compose up -d dan semua service.`);
    }

    // Register
    await api('/auth/register', {
      method: 'POST',
      body: { email, password: PASSWORD, name: tag, role: Role.CUSTOMER },
    });
  });

  it('Login mengatur Set-Cookie HttpOnly dll', async () => {
    const res = await api<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { email, password: PASSWORD },
    });
    expect(res.status).toBe(200);
    
    rawToken = res.body.accessToken;
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('access_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toContain('Domain=');
    
    const tokenMatch = setCookie!.match(/access_token=([^;]+)/);
    cookieHeaderStr = `access_token=${tokenMatch![1]}`;
  });

  it('GET /auth/me sukses hanya dengan cookie', async () => {
    const res = await api('/auth/me', { cookie: cookieHeaderStr });
    expect(res.status).toBe(200);
  });

  it('POST dengan cookie tanpa X-Requested-With ditolak CSRF', async () => {
    const res = await api('/orders', {
      method: 'POST',
      cookie: cookieHeaderStr,
      body: { pickup: { lat: 0, lng: 0 }, dropoff: { lat: 0, lng: 0 } },
    });
    expect(res.status).toBe(403);
    expect((res.body as any).code).toBe('CSRF_HEADER_REQUIRED');
  });

  it('POST dengan cookie + X-Requested-With sukses (atau setidaknya lolos auth/400)', async () => {
    const res = await api('/orders', {
      method: 'POST',
      cookie: cookieHeaderStr,
      csrf: true,
      body: { pickup: { lat: 0, lng: 0 }, dropoff: { lat: 0, lng: 0 } },
    });
    expect([201, 400]).toContain(res.status);
  });

  it('POST dengan Bearer bebas CSRF', async () => {
    const res = await api('/orders', {
      method: 'POST',
      token: rawToken,
      body: { pickup: { lat: 0, lng: 0 }, dropoff: { lat: 0, lng: 0 } },
    });
    expect([201, 400]).toContain(res.status);
  });

  it('Preflight OPTIONS mengembalikan CORS credentials', async () => {
    const res = await fetch(BASE + '/auth/me', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      }
    });
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('Preflight dari origin asing tidak dapat header CORS credentials', async () => {
    const res = await fetch(BASE + '/auth/me', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://evil.com',
        'Access-Control-Request-Method': 'GET',
      }
    });
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('WebSocket sukses dengan auth.token (Bearer via socket auth)', async () => {
    const socket = io(BASE, {
      auth: { token: rawToken },
      transports: ['websocket'],
      reconnection: false,
    });
    await new Promise<void>((res, rej) => {
      socket.once('connect', res);
      socket.once('connect_error', rej);
    });
    expect(socket.connected).toBe(true);
    socket.close();
  });

  it('WebSocket sukses dengan cookie + Origin terdaftar', async () => {
    const socket = io(BASE, {
      extraHeaders: {
        cookie: cookieHeaderStr,
        origin: 'http://localhost:5173'
      },
      transports: ['websocket'],
      reconnection: false,
    });
    await new Promise<void>((res, rej) => {
      socket.once('connect', res);
      socket.once('connect_error', rej);
    });
    expect(socket.connected).toBe(true);
    socket.close();
  });

  it('WebSocket gagal dengan cookie tanpa Origin terdaftar', async () => {
    const socket = io(BASE, {
      extraHeaders: {
        cookie: cookieHeaderStr,
        origin: 'http://evil.com'
      },
      transports: ['websocket'],
      reconnection: false,
    });
    
    const reason = await new Promise<string>((res) => {
      socket.once('disconnect', res);
    });
    expect(reason).toBe('io server disconnect');
  });

  it('Logout menghapus cookie dan GET /auth/me setelahnya 401', async () => {
    const res = await api('/auth/logout', { method: 'POST', cookie: cookieHeaderStr });
    expect(res.status).toBe(204);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    expect(setCookie).toContain('access_token=');
    expect(setCookie).toContain('HttpOnly');

    const me = await api('/auth/me');
    expect(me.status).toBe(401);
  });
});
