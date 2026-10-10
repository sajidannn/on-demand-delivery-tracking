import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api/client';

type Order = {
  id: string;
  status: string;
  estimatedPrice: number;
  estimatedDistance: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  createdAt: string;
};

export default function CustomerHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data, error: apiError } = await apiClient.GET('/orders');
        if (apiError) throw apiError;
        // Sort by newest first
        const sorted = (data || []).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setOrders(sorted as unknown as Order[]);
      } catch (err: any) {
        setError(String(err.message || 'Gagal memuat riwayat pesanan'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-3 py-1 bg-[#FEF3C7] text-[#451A03] text-[12px] font-bold rounded-full">
            Mencari Kurir
          </span>
        );
      case 'DRIVER_ASSIGNED':
        return (
          <span className="px-3 py-1 bg-[#EFF6FF] text-[#1E40AF] text-[12px] font-bold rounded-full">
            Kurir Menuju Lokasi
          </span>
        );
      case 'PICKED_UP':
        return (
          <span className="px-3 py-1 bg-[#FAF5FF] text-[#6B21A8] text-[12px] font-bold rounded-full">
            Pesanan Diambil
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-3 py-1 bg-[#F0FDF4] text-[#052E16] text-[12px] font-bold rounded-full">
            Selesai
          </span>
        );
      case 'NO_DRIVER_AVAILABLE':
        return (
          <span className="px-3 py-1 bg-[#FEF2F2] text-[#7F1D1D] text-[12px] font-bold rounded-full">
            Dibatalkan
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-surface-container text-on-surface text-[12px] font-bold rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto w-full p-4 h-full overflow-y-auto pb-24">
      <h2 className="text-[24px] font-bold text-on-surface mb-6">
        Riwayat Pesanan
      </h2>

      {error && (
        <div className="p-4 mb-4 bg-error-container text-on-error-container rounded-[20px] text-[14px]">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center p-8 bg-surface-container-lowest border border-surface-container-highest rounded-[20px]">
          <p className="text-on-surface-variant text-[14px]">
            Belum ada riwayat pesanan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              to={`/customer/track/${order.id}`}
              key={order.id}
              className="block bg-surface-container-lowest p-5 rounded-[20px] border border-surface-container-highest shadow-level-1 hover:border-primary-container transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[12px] text-on-surface-variant">
                  {new Date(order.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className="mb-4">
                <div className="text-[18px] font-bold text-on-surface">
                  Rp {order.estimatedPrice?.toLocaleString('id-ID') ?? 0}
                </div>
                <div className="text-[14px] text-on-surface-variant mt-1">
                  Jarak tempuh: {((order.estimatedDistance || 0) / 1000).toFixed(1)} km
                </div>
              </div>

              <div className="flex items-center text-[14px] font-bold text-primary">
                Lihat Detail Pesanan &rarr;
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
