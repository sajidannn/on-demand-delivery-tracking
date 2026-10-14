import { getOrderStatusInfo } from '../lib/order-status';

export default function OrderStatusBadge({
  status,
  className = '',
}: {
  status?: string;
  className?: string;
}) {
  const info = getOrderStatusInfo(status);

  return (
    <span
      className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-[13px] font-bold shadow-xs transition-colors ${info.badgeClass} ${className}`}
    >
      {info.dotColor && (
        <span
          className="w-2 h-2 rounded-full mr-2 shrink-0 animate-pulse"
          style={{ backgroundColor: info.dotColor }}
        />
      )}
      {info.label}
    </span>
  );
}
