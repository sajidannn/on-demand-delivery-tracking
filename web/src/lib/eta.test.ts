import { describe, it, expect } from 'vitest';
import {
  isTerminalStatus,
  formatTripDuration,
  formatArrivalTime,
  pickedUpAt,
  inTransitArrival,
} from './eta';
import type { OrderHistoryItem } from './order-timeline';

const history: OrderHistoryItem[] = [
  { status: 'PENDING', at: '2026-10-14T06:45:00.000Z', actor: 'CUSTOMER' },
  { status: 'DRIVER_ASSIGNED', at: '2026-10-14T06:46:00.000Z', actor: 'SYSTEM' },
  { status: 'PICKED_UP', at: '2026-10-14T06:48:00.000Z', actor: 'DRIVER' },
];

describe('eta', () => {
  describe('isTerminalStatus', () => {
    it('true untuk status akhir', () => {
      expect(isTerminalStatus('COMPLETED')).toBe(true);
      expect(isTerminalStatus('NO_DRIVER_AVAILABLE')).toBe(true);
      expect(isTerminalStatus('CANCELLED')).toBe(true);
    });

    it('false untuk status berjalan', () => {
      expect(isTerminalStatus('PENDING')).toBe(false);
      expect(isTerminalStatus('DRIVER_ASSIGNED')).toBe(false);
      expect(isTerminalStatus('PICKED_UP')).toBe(false);
    });
  });

  describe('formatTripDuration', () => {
    it('membulatkan detik ke menit', () => {
      expect(formatTripDuration(241)).toBe('4 mnt');
      expect(formatTripDuration(90)).toBe('2 mnt');
    });

    it('menampilkan <1 mnt untuk durasi sangat singkat', () => {
      expect(formatTripDuration(20)).toBe('<1 mnt');
    });

    it('null bila durasi tidak ada/tidak valid', () => {
      expect(formatTripDuration(undefined)).toBeNull();
      expect(formatTripDuration(null)).toBeNull();
      expect(formatTripDuration(0)).toBeNull();
      expect(formatTripDuration(-5)).toBeNull();
    });
  });

  describe('formatArrivalTime', () => {
    it('menghitung jam lokal dari base + durationS', () => {
      const base = new Date('2026-10-14T06:45:00.000Z');
      const expected = new Date(base.getTime() + 241 * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      expect(formatArrivalTime(base, 241)).toBe(expected);
    });

    it('null bila base null atau durasi tidak valid', () => {
      expect(formatArrivalTime(null, 241)).toBeNull();
      expect(formatArrivalTime(new Date('invalid'), 241)).toBeNull();
      expect(formatArrivalTime(new Date(), undefined)).toBeNull();
      expect(formatArrivalTime(new Date(), 0)).toBeNull();
    });
  });

  describe('pickedUpAt', () => {
    it('mengambil waktu PICKED_UP dari riwayat', () => {
      expect(pickedUpAt(history)?.toISOString()).toBe('2026-10-14T06:48:00.000Z');
    });

    it('null bila belum ada PICKED_UP atau history kosong', () => {
      expect(pickedUpAt([])).toBeNull();
      expect(pickedUpAt(undefined)).toBeNull();
      expect(
        pickedUpAt([{ status: 'PENDING', at: '2026-10-14T06:45:00.000Z', actor: 'CUSTOMER' }]),
      ).toBeNull();
    });
  });

  describe('inTransitArrival', () => {
    it('hanya menghitung saat status PICKED_UP', () => {
      const expected = formatArrivalTime(pickedUpAt(history), 241);
      expect(inTransitArrival('PICKED_UP', history, 241)).toBe(expected);
    });

    it('null untuk status sebelum/sesudah perjalanan', () => {
      expect(inTransitArrival('PENDING', history, 241)).toBeNull();
      expect(inTransitArrival('DRIVER_ASSIGNED', history, 241)).toBeNull();
      expect(inTransitArrival('COMPLETED', history, 241)).toBeNull();
    });

    it('null bila durasi tidak tersedia', () => {
      expect(inTransitArrival('PICKED_UP', history, undefined)).toBeNull();
    });
  });
});
