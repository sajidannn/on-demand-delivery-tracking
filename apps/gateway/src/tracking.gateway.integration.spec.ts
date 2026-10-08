import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Role, OrderStatus } from '@app/common';
import { TrackingGateway } from './tracking.gateway.js';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TrackingGateway + Socket.IO sungguhan', () => {
  const http = createServer();
  const io = new Server(http);
  let port = 0;
  let orderDriverId = 'd1';
  const authClient = {
    send: vi.fn((_p: string, { token }: { token: string }) => {
      if (token === 'cust') return of({ userId: 'c1', role: Role.CUSTOMER });
      if (token === 'drv') return of({ userId: 'd1', role: Role.DRIVER });
      return throwError(() => ({ code: 'UNAUTHORIZED', message: 'bad' }));
    }),
  };
  const orderClient = {
    send: vi.fn(() =>
      of({
        id: 'o1',
        customerId: 'c1',
        driverId: orderDriverId,
        status: OrderStatus.DRIVER_ASSIGNED,
      }),
    ),
  };
  const locationClient = { emit: vi.fn(() => of({})) };
  const gateway = new TrackingGateway(
    authClient as never,
    orderClient as never,
    locationClient as never,
  );
  const serverSide = new Map<string, import('socket.io').Socket>();
  const clients: ClientSocket[] = [];

  async function join(token: string) {
    const c = connect(`http://localhost:${port}`, {
      auth: { token },
      reconnection: false,
    });
    clients.push(c);
    await new Promise<void>((res) => c.once('connect', () => res()));
    await wait(100);
    return c;
  }

  beforeAll(async () => {
    gateway.server = io;
    io.on('connection', (s) => {
      void gateway.handleConnection(s).then(() => {
        if (s.data.user) serverSide.set(s.data.user.userId, s);
      });
    });
    await new Promise<void>((r) => http.listen(0, () => r()));
    port = (http.address() as AddressInfo).port;
  });
  afterAll(async () => {
    clients.forEach((c) => c.close());
    await io.close();
  });

  it('alur penuh: subscribe, ping ke room, status ke customer DAN driver', async () => {
    const customer = await join('cust');
    const driver = await join('drv');
    const got = { loc: 0, custStatus: 0, drvStatus: 0 };
    customer.on('order:location', () => got.loc++);
    customer.on('order:status', () => got.custStatus++);
    driver.on('order:status', () => got.drvStatus++);

    const ack = await gateway.handleOrderSubscribe(serverSide.get('c1')!, {
      orderId: 'o1',
    } as never);
    expect(ack.ok).toBe(true);

    await gateway.handleDriverLocation(serverSide.get('d1')!, {
      lat: -6.2,
      lng: 106.8,
      orderId: 'o1',
    } as never);
    gateway.broadcastOrderStatus(
      { orderId: 'o1', status: OrderStatus.PICKED_UP },
      'c1',
      'd1',
    );
    await wait(300);

    expect(got).toEqual({ loc: 1, custStatus: 1, drvStatus: 1 });
    expect(locationClient.emit).toHaveBeenCalledTimes(1);
  });

  it('driver lain tidak bisa menyuntik lokasi ke order orang lain', async () => {
    orderDriverId = 'someone-else';
    serverSide.get('d1')!.data.activeOrders = undefined;
    await expect(
      gateway.handleDriverLocation(serverSide.get('d1')!, {
        lat: 1,
        lng: 1,
        orderId: 'o1',
      } as never),
    ).rejects.toMatchObject({ error: { code: 'FORBIDDEN' } });
    orderDriverId = 'd1';
  });

  it('token salah langsung diputus', async () => {
    const c = connect(`http://localhost:${port}`, {
      auth: { token: 'xxx' },
      reconnection: false,
    });
    clients.push(c);
    const reason = await new Promise<string>((res) =>
      c.once('disconnect', (r) => res(r)),
    );
    expect(reason).toBe('io server disconnect');
  });
});
