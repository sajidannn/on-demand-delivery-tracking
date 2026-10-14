import { io, type Socket } from 'socket.io-client';

/**
 * Payload WebSocket tidak ada di OpenAPI, jadi tipenya ditulis manual
 * mengikuti TSD §7. Jangan mengimpor tipe dari `libs/common`.
 */

export interface OrderStatusEvent {
  orderId: string;
  status: string;
  driverId?: string;
  /** ISO-8601 UTC, berasal dari `occurred_at` riwayat di backend. */
  at?: string;
}

export interface OrderLocationEvent {
  orderId: string;
  lat: number;
  lng: number;
  ts: number;
}

export const WS_EVENTS = {
  DRIVER_LOCATION: 'driver:location',
  ORDER_SUBSCRIBE: 'order:subscribe',
  ORDER_LOCATION: 'order:location',
  ORDER_STATUS: 'order:status',
} as const;

/**
 * Membuat koneksi Socket.IO. Karena sesi memakai cookie HttpOnly, koneksi
 * mengandalkan `withCredentials` dan tidak mengirim `auth.token`.
 */
export function createSocket(): Socket {
  const baseUrl =
    typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : '/';

  return io(baseUrl, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
  });
}
