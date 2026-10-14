import { buildTimeline, type OrderHistoryItem, type TimelineEntry } from '../lib/order-timeline';

interface OrderTimelineProps {
  history?: OrderHistoryItem[];
  /** Judul panel, default "Riwayat Pesanan". */
  title?: string;
}

function TimelineRow({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  const dotColor = entry.dotColor ?? '#9CA3AF';

  return (
    <li className="relative pl-9">
      {/* Garis penghubung vertikal ke tahap berikutnya */}
      {!isLast && (
        <span
          className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-surface-container-highest"
          aria-hidden="true"
        />
      )}

      {/* Titik status */}
      <span
        className={`absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface-container-lowest shadow-level-1 ${
          entry.isLatest ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />

      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`text-[14px] leading-5 ${
            entry.isLatest
              ? 'font-bold text-on-surface'
              : 'font-semibold text-on-surface-variant'
          }`}
        >
          {entry.statusLabel}
        </span>
        <span className="shrink-0 font-mono text-[13px] text-on-surface-variant">
          {entry.timeLabel}
        </span>
      </div>

      <p className="mt-0.5 text-[12px] leading-4 text-on-surface-variant">
        {entry.description}
      </p>

      {entry.durationLabel && (
        <span className="mt-2 inline-flex items-center rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
          {entry.durationLabel}
        </span>
      )}
    </li>
  );
}

export default function OrderTimeline({ history, title = 'Riwayat Pesanan' }: OrderTimelineProps) {
  const entries = buildTimeline(history);

  if (entries.length === 0) return null;

  return (
    <section aria-label={title} className="rounded-[16px] bg-surface-container-low p-4">
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-on-surface-variant">
        {title}
      </h3>
      <ol className="space-y-5">
        {entries.map((entry, index) => (
          <TimelineRow
            key={`${entry.status}-${entry.at}`}
            entry={entry}
            isLast={index === entries.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}
