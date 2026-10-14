import type { OrderHistoryItem } from './order-timeline';

/** Status akhir: tidak ada lagi perjalanan yang perlu diperkirakan. */
const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'NO_DRIVER_AVAILABLE',
  'CANCELLED',
]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Label durasi perjalanan (pickup→dropoff) dari `durationS` backend,
 * mis. `±4 mnt`. Mengembalikan `null` bila durasi tidak tersedia/<= 0.
 */
export function formatTripDuration(durationS?: number | null): string | null {
  if (durationS === undefined || durationS === null || durationS <= 0) {
    return null;
  }
  const minutes = Math.round(durationS / 60);
  return minutes < 1 ? '<1 mnt' : `${minutes} mnt`;
}

/**
 * Jam tiba lokal perangkat (`HH:mm`) dari `base + durationS`.
 * Mengembalikan `null` bila `base` atau durasi tidak valid.
 */
export function formatArrivalTime(
  base: Date | null,
  durationS?: number | null,
): string | null {
  if (!base || Number.isNaN(base.getTime())) return null;
  if (durationS === undefined || durationS === null || durationS <= 0) {
    return null;
  }
  const arrival = new Date(base.getTime() + durationS * 1000);
  return arrival.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Waktu status `PICKED_UP` dari riwayat, `null` bila belum ada/tidak valid. */
export function pickedUpAt(history?: OrderHistoryItem[]): Date | null {
  const item = history?.find((entry) => entry.status === 'PICKED_UP');
  if (!item) return null;
  const date = new Date(item.at);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Perkiraan tiba untuk pesanan yang **sedang diantar** (`PICKED_UP`):
 * waktu pickup + durasi rute pickup→dropoff. Untuk status sebelum pickup,
 * waktu keberangkatan belum pasti sehingga perkiraan absolut tidak ditampilkan.
 */
export function inTransitArrival(
  status: string,
  history: OrderHistoryItem[] | undefined,
  durationS?: number | null,
): string | null {
  if (status !== 'PICKED_UP') return null;
  return formatArrivalTime(pickedUpAt(history), durationS);
}
