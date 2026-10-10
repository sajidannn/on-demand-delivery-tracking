import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";

type Order = {
  id: string;
  status: string;
  estimatedPrice: number;
  estimatedDistance: number;
  createdAt: string;
};

export default function DriverHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { data, error: apiError } = await apiClient.GET("/orders");
        if (apiError) throw apiError;
        
        // Filter for completed orders
        const completedOrders = (data || []).filter((o) => o.status === "COMPLETED");
        
        // Sort by newest first
        const sorted = completedOrders.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(sorted as unknown as Order[]);
      } catch (err: any) {
        setError(String(err.message || "Gagal memuat riwayat pesanan"));
      } finally {
        setIsLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <div className="max-w-md mx-auto w-full p-4 h-full overflow-y-auto pb-24">
      <h2 className="text-[24px] font-bold text-on-surface mb-6">Riwayat Order (Selesai)</h2>
      
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
          <p className="text-on-surface-variant text-[14px]">Belum ada pesanan yang diselesaikan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="block bg-surface-container-lowest p-5 rounded-[20px] border border-surface-container-highest shadow-level-1"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-[12px] text-on-surface-variant">
                  {new Date(order.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <span className="px-3 py-1 bg-[#F0FDF4] text-[#052E16] text-[12px] font-bold rounded-full">
                  Selesai
                </span>
              </div>
              
              <div className="mb-2">
                <div className="text-[18px] font-bold text-on-surface">
                  Pendapatan: Rp {order.estimatedPrice?.toLocaleString("id-ID") ?? 0}
                </div>
                <div className="text-[14px] text-on-surface-variant mt-1">
                  Jarak tempuh: {((order.estimatedDistance || 0) / 1000).toFixed(1)} km
                </div>
              </div>
              
              <div className="text-[12px] text-on-surface-variant mt-4 pt-4 border-t border-surface-container-highest">
                ID Pesanan: {order.id.split("-")[0]}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
