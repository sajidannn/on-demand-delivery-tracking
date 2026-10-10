import { useState, useEffect } from "react";
import { apiClient } from "../../lib/api/client";
import { useAuth } from "../../contexts/AuthContext";

type OrderStatus = "DRIVER_ASSIGNED" | "PICKED_UP" | "COMPLETED";

export default function DriverDashboard() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const { data, error: apiError } = await apiClient.GET("/orders");
      if (apiError) {
        setError(String(apiError.message || "Gagal memuat pesanan"));
      } else if (data) {
        // Filter orders assigned to this driver that are active
        const activeOrders = Array.isArray(data) 
          ? data.filter(o => o.status !== "COMPLETED") 
          : [];
        setOrders(activeOrders);
      }
    } catch (err) {
      setError("Kesalahan jaringan saat memuat pesanan");
    }
  };

  useEffect(() => {
    fetchOrders();
    // Simple polling for new orders every 5 seconds
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleOnline = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      if (isOnline) {
        const { error: apiError } = await apiClient.POST("/drivers/offline");
        if (apiError) throw apiError;
        setIsOnline(false);
      } else {
        // Dummy location for testing, normally from navigator.geolocation
        const { error: apiError } = await apiClient.POST("/drivers/online", {
          body: { lat: -6.9147, lng: 107.6098 },
        });
        if (apiError) throw apiError;
        setIsOnline(true);
      }
    } catch (err: any) {
      setError(String(err.message || "Gagal mengubah status"));
    } finally {
      setIsUpdating(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: "PICKED_UP" | "COMPLETED") => {
    setIsUpdating(true);
    try {
      const { error: apiError } = await apiClient.PATCH("/orders/{id}/status", {
        params: { path: { id: orderId } },
        body: { status },
      });
      if (apiError) throw apiError;
      await fetchOrders();
    } catch (err: any) {
      setError(String(err.message || "Gagal mengubah status pesanan"));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-surface-container-lowest rounded-[24px] shadow-level-2 p-6 mb-8 border border-surface-container">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-[24px] font-bold text-on-surface tracking-[-0.02em]">
              Halo, {user?.name}
            </h1>
            <p className="text-[14px] text-on-surface-variant mt-1">
              {isOnline ? "Anda sedang online dan siap menerima order." : "Anda sedang offline."}
            </p>
          </div>
          <button
            onClick={toggleOnline}
            disabled={isUpdating}
            className={`h-12 px-6 text-[14px] font-bold rounded-full transition-all flex items-center justify-center min-w-30 ${
              isOnline 
                ? "bg-error text-on-error hover:bg-error/90" 
                : "bg-primary-container text-on-primary-container hover:bg-primary-container/90"
            }`}
          >
            {isUpdating ? "..." : isOnline ? "Offline" : "Online"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-error-container text-on-error-container p-4 rounded-[16px] text-[14px]">
          {error}
        </div>
      )}

      <h2 className="text-[18px] font-bold text-on-surface mb-4 px-2">Pesanan Aktif</h2>
      
      {orders.length === 0 ? (
        <div className="bg-surface-container-low rounded-[24px] p-8 text-center border border-surface-container-highest border-dashed">
          <p className="text-[14px] text-on-surface-variant">Belum ada pesanan yang ditugaskan kepada Anda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-surface-container-lowest rounded-[20px] shadow-level-1 p-6 border border-surface-container-highest">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container text-[12px] font-bold rounded-full mb-2">
                    {order.status}
                  </span>
                  <p className="text-[12px] text-on-surface-variant font-mono">{order.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[18px] font-bold text-on-surface">Rp{order.fee.toLocaleString("id-ID")}</p>
                  <p className="text-[12px] text-on-surface-variant">{(order.distanceM / 1000).toFixed(1)} km</p>
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-surface-container-low p-4 rounded-[16px]">
                <div className="flex gap-3">
                  <div className="w-3 h-3 mt-1 rounded-full border-2 border-primary-container shrink-0" />
                  <div>
                    <p className="text-[12px] text-on-surface-variant mb-1">Titik Jemput</p>
                    <p className="text-[14px] font-medium text-on-surface truncate">
                      {order.pickup.lat.toFixed(5)}, {order.pickup.lng.toFixed(5)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 mt-1 rounded-full bg-error shrink-0" />
                  <div>
                    <p className="text-[12px] text-on-surface-variant mb-1">Titik Tujuan</p>
                    <p className="text-[14px] font-medium text-on-surface truncate">
                      {order.dropoff.lat.toFixed(5)}, {order.dropoff.lng.toFixed(5)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {order.status === "DRIVER_ASSIGNED" && (
                  <button
                    onClick={() => updateOrderStatus(order.id, "PICKED_UP")}
                    disabled={isUpdating}
                    className="flex-1 h-12 bg-primary text-on-primary text-[14px] font-bold rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Pesanan Diambil
                  </button>
                )}
                {order.status === "PICKED_UP" && (
                  <button
                    onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                    disabled={isUpdating}
                    className="flex-1 h-12 bg-primary text-on-primary text-[14px] font-bold rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Selesaikan Pesanan
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
