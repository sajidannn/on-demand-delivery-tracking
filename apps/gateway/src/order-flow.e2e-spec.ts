import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  OrderStatus,
  Role,
  WS_EVENTS,
  type OrderLocationPayload,
  type OrderStatusPayload,
} from '@app/common';

/**
 * E2E alur order penuh. Menembak stack yang SEDANG BERJALAN
 * (docker compose up -d + semua service hidup), bukan boot in-process.
 * Jalankan: bun run test:e2e
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const PASSWORD = 'Passw0rd!';
/** handleConnection memvalidasi token secara asinkron setelah event "connect". */
const AUTH_SETTLE_MS = 400;

interface ApiResult<T = Record<string, unknown>> {
  status: number;
  body: T;
}

interface OrderBody {
  id: string;
  status: OrderStatus;
  driverId?: string;
  distanceM: number;
  fee: number;
}

interface Actor {
  id: string;
  token: string;
}

interface Driver extends Actor {
  lat: number;
  lng: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<ApiResult<T>> {
  const res = await fetch(BASE + path, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

async function waitFor<T>(
  probe: () => T | undefined,
  timeoutMs = 5000,
  label = 'kondisi',
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = probe();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timeout menunggu ${label}`);
    }
    await sleep(50);
  }
}

async function registerAndLogin(role: Role, tag: string): Promise<Actor> {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
  const reg = await api<{ id: string }>('/auth/register', {
    method: 'POST',
    body: { email, password: PASSWORD, name: tag, role },
  });
  expect(reg.status).toBe(201);
  const login = await api<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  expect(login.status).toBe(200);
  return { id: reg.body.id, token: login.body.accessToken };
}

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

describe('E2E alur order penuh', () => {
  // Titik jemput acak per run supaya driver sisa run/demo lain tidak ikut terpilih.
  const pickup = {
    lat: -7 - Math.random(),
    lng: 108 + Math.random() * 3,
  };
  const dropoff = { lat: pickup.lat + 0.01, lng: pickup.lng + 0.01 };

  let customer: Actor;
  let otherCustomer: Actor;
  let drivers: Driver[] = []; // urut dari terdekat ke terjauh
  const orders: { id: string; driver?: Driver }[] = [];
  const sockets: Socket[] = [];

  const driverOf = (id?: string) => drivers.find((d) => d.id === id);
  const createOrder = () =>
    api<OrderBody>('/orders', {
      method: 'POST',
      token: customer.token,
      body: { pickup, dropoff },
    });
  const estimateOrder = () =>
    api<{ distanceM: number; fee: number; routeSource: string; route?: any }>('/orders/estimate', {
      method: 'POST',
      token: customer.token,
      body: { pickup, dropoff },
    });
  const setStatus = (orderId: string, token: string, status: OrderStatus) =>
    api<OrderBody>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      token,
      body: { status },
    });

  beforeAll(async () => {
    const health = await fetch(`${BASE}/health`).catch(() => null);
    if (!health?.ok) {
      throw new Error(
        `Gateway tidak terjangkau di ${BASE}. Jalankan docker compose up -d dan semua service dulu.`,
      );
    }

    customer = await registerAndLogin(Role.CUSTOMER, 'cust');
    otherCustomer = await registerAndLogin(Role.CUSTOMER, 'cust2');

    // Offset lintang ±222 m, ±667 m, ±1334 m dari titik jemput.
    const offsets = [0.002, 0.006, 0.012];
    drivers = await Promise.all(
      offsets.map(async (offset, i) => {
        const actor = await registerAndLogin(Role.DRIVER, `drv${i + 1}`);
        return { ...actor, lat: pickup.lat + offset, lng: pickup.lng };
      }),
    );
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    // Selesaikan order yang masih aktif agar driver dilepas, lalu offline-kan semua.
    for (const order of orders) {
      if (!order.driver) continue;
      await setStatus(order.id, order.driver.token, OrderStatus.PICKED_UP);
      await setStatus(order.id, order.driver.token, OrderStatus.COMPLETED);
    }
    await Promise.all(
      drivers.map((d) =>
        api('/drivers/offline', { method: 'POST', token: d.token }),
      ),
    );
  });

  it('AC-01: auth dan role (401 tanpa token, 403 role salah)', async () => {
    const me = await api('/auth/me', { token: customer.token });
    expect(me.status).toBe(200);

    expect((await api('/auth/me')).status).toBe(401);

    const asDriver = await api('/orders', {
      method: 'POST',
      token: drivers[0].token,
      body: { pickup, dropoff },
    });
    expect(asDriver.status).toBe(403);
  });

  it('AC-03: tiga driver online di tiga jarak berbeda', async () => {
    for (const d of drivers) {
      const res = await api('/drivers/online', {
        method: 'POST',
        token: d.token,
        body: { lat: d.lat, lng: d.lng },
      });
      expect(res.status).toBe(200);
    }
  });

  it('AC-02/03: order pertama di-assign ke driver terdekat, fee sesuai', async () => {
    // Cek estimasi dulu
    const est = await estimateOrder();
    expect(est.status).toBe(200);
    expect(est.body.distanceM).toBeGreaterThan(0);
    expect(est.body.fee).toBeGreaterThan(0);
    expect(['OSRM', 'STRAIGHT_LINE']).toContain(est.body.routeSource);

    const res = await createOrder();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.DRIVER_ASSIGNED);
    expect(res.body.driverId).toBe(drivers[0].id);
    expect(res.body.distanceM).toBe(est.body.distanceM);
    expect(res.body.fee).toBe(est.body.fee);
    orders.push({ id: res.body.id, driver: drivers[0] });
  });

  it('AC-09/02: driver tidak dobel, lalu NO_DRIVER_AVAILABLE', async () => {
    const second = await createOrder();
    expect(second.body.status).toBe(OrderStatus.DRIVER_ASSIGNED);
    expect(second.body.driverId).toBe(drivers[1].id);
    orders.push({ id: second.body.id, driver: drivers[1] });

    const third = await createOrder();
    expect(third.body.status).toBe(OrderStatus.DRIVER_ASSIGNED);
    expect(third.body.driverId).toBe(drivers[2].id);
    orders.push({ id: third.body.id, driver: drivers[2] });

    const fourth = await createOrder();
    expect(fourth.status).toBe(201);
    expect(fourth.body.status).toBe(OrderStatus.NO_DRIVER_AVAILABLE);
    expect(fourth.body.driverId).toBeUndefined();
  });

  describe('order pertama (WebSocket + status)', () => {
    let customerSocket: Socket;
    let driverSocket: Socket;
    const locations: OrderLocationPayload[] = [];
    const customerStatuses: OrderStatusPayload[] = [];
    const driverStatuses: OrderStatusPayload[] = [];

    it('AC-07: customer subscribe lalu menerima order:location dari ping driver', async () => {
      const orderId = orders[0].id;
      customerSocket = await connectSocket(customer.token);
      driverSocket = await connectSocket(drivers[0].token);
      sockets.push(customerSocket, driverSocket);

      customerSocket.on(WS_EVENTS.ORDER_LOCATION, (p: OrderLocationPayload) =>
        locations.push(p),
      );
      customerSocket.on(WS_EVENTS.ORDER_STATUS, (p: OrderStatusPayload) =>
        customerStatuses.push(p),
      );
      driverSocket.on(WS_EVENTS.ORDER_STATUS, (p: OrderStatusPayload) =>
        driverStatuses.push(p),
      );
      await sleep(AUTH_SETTLE_MS);

      const ack = (await customerSocket
        .timeout(3000)
        .emitWithAck(WS_EVENTS.ORDER_SUBSCRIBE, { orderId })) as {
        ok: boolean;
        status: OrderStatus;
      };
      expect(ack.ok).toBe(true);
      expect(ack.status).toBe(OrderStatus.DRIVER_ASSIGNED);

      driverSocket.emit(WS_EVENTS.DRIVER_LOCATION, {
        lat: drivers[0].lat,
        lng: drivers[0].lng,
        orderId,
      });
      const received = await waitFor(
        () => locations.find((l) => l.orderId === orderId),
        5000,
        'order:location di customer',
      );
      expect(received.lat).toBeCloseTo(drivers[0].lat, 6);
      expect(received.lng).toBeCloseTo(drivers[0].lng, 6);
    });

    it('AC-05: driver yang salah tidak boleh mengubah status (403)', async () => {
      const res = await setStatus(
        orders[0].id,
        drivers[1].token,
        OrderStatus.PICKED_UP,
      );
      expect(res.status).toBe(403);
    });

    it('AC-04: transisi ilegal ditolak (409)', async () => {
      const jump = await setStatus(
        orders[0].id,
        drivers[0].token,
        OrderStatus.COMPLETED,
      );
      expect(jump.status).toBe(409);
    });

    it('AC-04/06: PICKED_UP lalu COMPLETED, status dipush ke customer dan driver', async () => {
      const orderId = orders[0].id;

      const picked = await setStatus(
        orderId,
        drivers[0].token,
        OrderStatus.PICKED_UP,
      );
      expect(picked.status).toBe(200);
      expect(picked.body.status).toBe(OrderStatus.PICKED_UP);

      const repeat = await setStatus(
        orderId,
        drivers[0].token,
        OrderStatus.PICKED_UP,
      );
      expect(repeat.status).toBe(409);

      const done = await setStatus(
        orderId,
        drivers[0].token,
        OrderStatus.COMPLETED,
      );
      expect(done.status).toBe(200);
      expect(done.body.status).toBe(OrderStatus.COMPLETED);
      orders[0].driver = undefined; // sudah selesai, tidak perlu dibersihkan

      for (const [who, list] of [
        ['customer', customerStatuses],
        ['driver', driverStatuses],
      ] as const) {
        await waitFor(
          () => list.find((s) => s.status === OrderStatus.PICKED_UP),
          5000,
          `order:status PICKED_UP di ${who}`,
        );
        await waitFor(
          () => list.find((s) => s.status === OrderStatus.COMPLETED),
          5000,
          `order:status COMPLETED di ${who}`,
        );
      }
    });
  });

  it('AC-10: driver yang selesai bisa di-assign lagi', async () => {
    const res = await createOrder();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe(OrderStatus.DRIVER_ASSIGNED);
    expect(res.body.driverId).toBe(drivers[0].id);
    orders.push({ id: res.body.id, driver: driverOf(res.body.driverId) });
  });

  it('AC-05: customer lain tidak boleh melihat order orang lain (403)', async () => {
    const res = await api(`/orders/${orders[1].id}`, {
      token: otherCustomer.token,
    });
    expect(res.status).toBe(403);

    const own = await api(`/orders/${orders[1].id}`, { token: customer.token });
    expect(own.status).toBe(200);
  });
});

describe('AC-08: Swagger lengkap', () => {
  interface Operation {
    summary?: string;
    security?: unknown[];
    requestBody?: unknown;
    responses?: Record<string, unknown>;
  }

  it('setiap endpoint punya summary, respons sukses, dan 401 bila terlindungi', async () => {
    const res = await api<{ paths: Record<string, Record<string, Operation>> }>(
      '/docs-json',
    );
    expect(res.status).toBe(200);

    const problems: string[] = [];
    for (const [path, methods] of Object.entries(res.body.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const label = `${method.toUpperCase()} ${path}`;
        const codes = Object.keys(op.responses ?? {});
        if (!op.summary) problems.push(`${label}: tanpa summary`);
        if (!codes.some((c) => c.startsWith('2'))) {
          problems.push(`${label}: tanpa respons 2xx`);
        }
        if (op.security?.length && !codes.includes('401')) {
          problems.push(`${label}: terlindungi tapi tanpa respons 401`);
        }
        if (['post', 'patch'].includes(method) && !op.requestBody) {
          const noBodyOk = path.startsWith('/drivers/offline');
          if (!noBodyOk) problems.push(`${label}: tanpa requestBody`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
