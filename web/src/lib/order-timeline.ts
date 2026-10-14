import { getOrderStatusInfo } from './order-status';

/** Aktor yang menulis sebuah baris riwayat, sesuai `actor_type` backend. */
export type HistoryActor = 'CUSTOMER' | 'SYSTEM' | 'DRIVER';

/** Satu baris riwayat status order (mengikuti `OrderStatusHistoryItemDto`). */
export interface OrderHistoryItem {
  status: string;
  at: string;
  actor: HistoryActor;
}

/** Entri timeline siap-render: riwayat + label turunan. */
export interface TimelineEntry extends OrderHistoryItem {
  /** Jam lokal perangkat, format HH:mm. */
  timeLabel: string;
  /** Label status yang ramah pengguna. */
  statusLabel: string;
  /** Deskripsi singkat untuk customer. */
  description: string;
  /** Durasi menuju tahap berikutnya, mis. "Menunggu driver 2 mnt". */
  durationLabel?: string;
  /** Warna titik status. */
  dotColor?: string;
  /** Apakah ini tahap terbaru. */
  isLatest: boolean;
}

/**
 * Label fase untuk segmen menuju tahap berikutnya. Dikaitkan dengan status
 * asal (tahap yang sedang berjalan), bukan status tujuan.
 */
const PHASE_LABEL: Record<string, string> = {
  PENDING: 'Menunggu driver',
  DRIVER_ASSIGNED: 'Driver menuju pickup',
  PICKED_UP: 'Perjalanan pengantaran',
};

/** Format string ISO-8601 menjadi jam lokal perangkat `HH:mm`. */
export function formatLocalTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format durasi (milidetik):
 * - < 1 menit → detik, mis. `45 dtk`
 * - < 1 jam → menit, mis. `17 mnt`
 * - >= 1 jam → `1 jam 5 mnt`
 */
export function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSeconds = Math.round(safeMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} dtk`;

  const totalMinutes = Math.round(safeMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes} mnt`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} jam ${minutes} mnt` : `${hours} jam`;
}

/**
 * Menurunkan aktor dari status. Dipakai hanya untuk entri yang datang lewat
 * WebSocket `order:status`, yang payload-nya tidak memuat `actor`. Nilai
 * otoritatif tetap berasal dari `history` server saat detail dimuat ulang.
 */
export function deriveActor(status: string): HistoryActor {
  switch (status) {
    case 'PENDING':
    case 'CANCELLED':
      return 'CUSTOMER';
    case 'PICKED_UP':
    case 'COMPLETED':
      return 'DRIVER';
    case 'DRIVER_ASSIGNED':
    case 'NO_DRIVER_AVAILABLE':
    default:
      return 'SYSTEM';
  }
}

/**
 * Mengubah riwayat menjadi entri timeline terurut menaik, dilengkapi label
 * jam lokal, status, dan durasi antar tahap.
 */
export function buildTimeline(
  history: OrderHistoryItem[] | undefined,
): TimelineEntry[] {
  if (!history || history.length === 0) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  return sorted.map((item, index) => {
    const info = getOrderStatusInfo(item.status);
    const next = sorted[index + 1];

    let durationLabel: string | undefined;
    if (next) {
      const gapMs = new Date(next.at).getTime() - new Date(item.at).getTime();
      const phase = PHASE_LABEL[item.status] ?? info.label;
      durationLabel = `${phase} ${formatDuration(gapMs)}`;
    }

    return {
      ...item,
      timeLabel: formatLocalTime(item.at),
      statusLabel: info.label,
      description: info.customerDescription,
      durationLabel,
      dotColor: info.dotColor,
      isLatest: index === sorted.length - 1,
    };
  });
}

/**
 * Menambahkan entri riwayat tanpa duplikat. Entri dianggap duplikat bila
 * pasangan (`status`, `at`) sudah ada. Hasil selalu terurut menaik.
 */
export function appendHistoryEntry(
  history: OrderHistoryItem[],
  entry: OrderHistoryItem,
): OrderHistoryItem[] {
  const exists = history.some(
    (item) => item.status === entry.status && item.at === entry.at,
  );
  if (exists) return history;

  return [...history, entry].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}
