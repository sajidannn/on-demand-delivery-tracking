import { describe, it, expect } from 'vitest';
import {
  formatLocalTime,
  formatDuration,
  deriveActor,
  buildTimeline,
  appendHistoryEntry,
  type OrderHistoryItem,
} from './order-timeline';

describe('order-timeline', () => {
  describe('formatLocalTime', () => {
    it('memformat ISO-8601 menjadi jam lokal HH:mm (2 digit)', () => {
      const iso = '2026-10-09T07:12:03.120Z';
      const result = formatLocalTime(iso);
      // Cocokkan dengan format lokal perangkat pada waktu yang sama
      const expected = new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      expect(result).toBe(expected);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('mengembalikan placeholder untuk tanggal tidak valid', () => {
      expect(formatLocalTime('bukan-tanggal')).toBe('--:--');
    });
  });

  describe('formatDuration', () => {
    it('menampilkan detik bila < 1 menit', () => {
      expect(formatDuration(45_000)).toBe('45 dtk');
      expect(formatDuration(0)).toBe('0 dtk');
    });

    it('menampilkan menit bila < 1 jam', () => {
      expect(formatDuration(2 * 60_000)).toBe('2 mnt');
      expect(formatDuration(17 * 60_000)).toBe('17 mnt');
    });

    it('menampilkan jam dan menit bila >= 1 jam', () => {
      expect(formatDuration(65 * 60_000)).toBe('1 jam 5 mnt');
      expect(formatDuration(120 * 60_000)).toBe('2 jam');
    });

    it('menangani nilai negatif/tidak valid sebagai 0', () => {
      expect(formatDuration(-1000)).toBe('0 dtk');
      expect(formatDuration(Number.NaN)).toBe('0 dtk');
    });
  });

  describe('deriveActor', () => {
    it('memetakan status ke aktor yang sesuai', () => {
      expect(deriveActor('PENDING')).toBe('CUSTOMER');
      expect(deriveActor('CANCELLED')).toBe('CUSTOMER');
      expect(deriveActor('DRIVER_ASSIGNED')).toBe('SYSTEM');
      expect(deriveActor('NO_DRIVER_AVAILABLE')).toBe('SYSTEM');
      expect(deriveActor('PICKED_UP')).toBe('DRIVER');
      expect(deriveActor('COMPLETED')).toBe('DRIVER');
    });
  });

  describe('buildTimeline', () => {
    const history: OrderHistoryItem[] = [
      { status: 'PENDING', at: '2026-10-09T07:12:00.000Z', actor: 'CUSTOMER' },
      {
        status: 'DRIVER_ASSIGNED',
        at: '2026-10-09T07:14:00.000Z',
        actor: 'SYSTEM',
      },
      { status: 'PICKED_UP', at: '2026-10-09T07:19:00.000Z', actor: 'DRIVER' },
      { status: 'COMPLETED', at: '2026-10-09T07:36:00.000Z', actor: 'DRIVER' },
    ];

    it('mengembalikan array kosong untuk history kosong/undefined', () => {
      expect(buildTimeline(undefined)).toEqual([]);
      expect(buildTimeline([])).toEqual([]);
    });

    it('mengurutkan entri menaik berdasarkan at', () => {
      const shuffled = [history[2], history[0], history[3], history[1]];
      const entries = buildTimeline(shuffled);
      expect(entries.map((e) => e.status)).toEqual([
        'PENDING',
        'DRIVER_ASSIGNED',
        'PICKED_UP',
        'COMPLETED',
      ]);
    });

    it('menghitung label durasi antar tahap dengan benar', () => {
      const entries = buildTimeline(history);
      expect(entries[0].durationLabel).toBe('Menunggu driver 2 mnt');
      expect(entries[1].durationLabel).toBe('Driver menuju pickup 5 mnt');
      expect(entries[2].durationLabel).toBe('Perjalanan pengantaran 17 mnt');
      expect(entries[3].durationLabel).toBeUndefined();
    });

    it('menandai hanya entri terakhir sebagai isLatest', () => {
      const entries = buildTimeline(history);
      expect(entries.map((e) => e.isLatest)).toEqual([
        false,
        false,
        false,
        true,
      ]);
    });

    it('menyertakan label jam lokal, label status, dan warna titik', () => {
      const entries = buildTimeline(history);
      expect(entries[0].timeLabel).toBe(formatLocalTime(history[0].at));
      expect(entries[0].statusLabel).toBe('Mencari Kurir');
      expect(entries[0].dotColor).toBe('#F59E0B');
    });

    it('menampilkan detik untuk tahap singkat (< 1 menit)', () => {
      const short: OrderHistoryItem[] = [
        {
          status: 'PENDING',
          at: '2026-10-09T07:12:00.000Z',
          actor: 'CUSTOMER',
        },
        {
          status: 'DRIVER_ASSIGNED',
          at: '2026-10-09T07:12:45.000Z',
          actor: 'SYSTEM',
        },
      ];
      const entries = buildTimeline(short);
      expect(entries[0].durationLabel).toBe('Menunggu driver 45 dtk');
    });
  });

  describe('appendHistoryEntry', () => {
    const base: OrderHistoryItem[] = [
      { status: 'PENDING', at: '2026-10-09T07:12:00.000Z', actor: 'CUSTOMER' },
    ];

    it('menambahkan entri baru', () => {
      const result = appendHistoryEntry(base, {
        status: 'DRIVER_ASSIGNED',
        at: '2026-10-09T07:14:00.000Z',
        actor: 'SYSTEM',
      });
      expect(result).toHaveLength(2);
      expect(result[1].status).toBe('DRIVER_ASSIGNED');
    });

    it('tidak menambahkan duplikat berdasarkan pasangan (status, at)', () => {
      const result = appendHistoryEntry(base, {
        status: 'PENDING',
        at: '2026-10-09T07:12:00.000Z',
        actor: 'CUSTOMER',
      });
      expect(result).toBe(base);
      expect(result).toHaveLength(1);
    });

    it('mengizinkan status sama dengan at berbeda', () => {
      const result = appendHistoryEntry(base, {
        status: 'PENDING',
        at: '2026-10-09T07:13:00.000Z',
        actor: 'CUSTOMER',
      });
      expect(result).toHaveLength(2);
    });

    it('selalu mengurutkan menaik', () => {
      const unordered: OrderHistoryItem[] = [
        {
          status: 'PICKED_UP',
          at: '2026-10-09T07:19:00.000Z',
          actor: 'DRIVER',
        },
      ];
      const result = appendHistoryEntry(unordered, {
        status: 'PENDING',
        at: '2026-10-09T07:12:00.000Z',
        actor: 'CUSTOMER',
      });
      expect(result.map((e) => e.status)).toEqual(['PENDING', 'PICKED_UP']);
    });
  });
});
