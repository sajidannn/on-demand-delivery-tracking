import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { io, Socket } from "socket.io-client";
import { apiClient } from "../../lib/api/client";

export default function CustomerTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    // Fetch initial order details
    const fetchOrder = async () => {
      try {
        const { data, error: apiError } = await apiClient.GET("/orders/{id}", {
          params: { path: { id: orderId } },
        });
        if (apiError) throw apiError;
        setOrder(data);
      } catch (err) {
        setError("Gagal memuat detail pesanan");
      }
    };
    fetchOrder();

    // Connect WebSocket
    // Since we use HttpOnly cookies, we rely on withCredentials
    const socketInstance = io(window.location.hostname === "localhost" ? "http://localhost:3000" : "/", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("WebSocket connected");
      // Subscribe to this order's updates
      socketInstance.emit("order:subscribe", { orderId });
    });

    socketInstance.on("order:status", (data) => {
      console.log("Status update:", data);
      setOrder((prev: any) => prev ? { ...prev, status: data.status } : null);
    });

    socketInstance.on("order:location", (data) => {
      console.log("Driver location update:", data);
      setDriverLocation({ lat: data.lat, lng: data.lng });
    });

    socketInstance.on("exception", (err) => {
      console.error("WS Exception:", err);
    });

    // Store in ref or just let it close on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [orderId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-surface">
        <div className="bg-error-container text-on-error-container p-6 rounded-[24px] max-w-md text-center">
          <h2 className="text-[20px] font-bold mb-2">Oops!</h2>
          <p>{error}</p>
          <button 
            onClick={() => navigate("/customer")}
            className="mt-6 px-6 py-2 bg-on-error-container text-error-container rounded-full font-bold"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return <div className="flex h-[calc(100vh-64px)] items-center justify-center">Memuat pesanan...</div>;
  }

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-surface-container-low">
      <MapContainer
        center={[order.pickup.lat, order.pickup.lng]}
        zoom={14}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Pickup & Dropoff Markers */}
        <Marker position={[order.pickup.lat, order.pickup.lng]} />
        <Marker position={[order.dropoff.lat, order.dropoff.lng]} />
        
        {/* Driver Marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} />
        )}
        
        {/* Route Render */}
        {order.route?.coordinates && (
          <>
            <Polyline 
              positions={order.route.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])} 
              color="#004b1e" 
              weight={8}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline 
              positions={order.route.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])} 
              color="#22c55e" 
              weight={4}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline 
              positions={order.route.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])} 
              color="#ffffff" 
              weight={3}
              dashArray="6, 18"
              opacity={0.8}
              lineCap="round"
              lineJoin="round"
              className="animate-route-flow"
            />
          </>
        )}
      </MapContainer>

      {/* Floating Status Panel */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-10">
        <div className="bg-surface-container-lowest rounded-[24px] shadow-level-3 p-5 sm:p-6 border border-surface-container">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-[20px] font-bold text-on-surface tracking-[-0.02em]">
                Status Pesanan
              </h2>
              <p className="text-[14px] text-on-surface-variant font-mono mt-1">
                ID: {order.id.slice(0, 8)}...
              </p>
            </div>
            <div className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-[14px] font-bold shadow-level-1">
              {order.status}
            </div>
          </div>

          <div className="space-y-2 mb-2 bg-surface-container-low p-4 rounded-[16px]">
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Harga:</span>
              <span className="font-bold text-on-surface">Rp{order.fee.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Jarak:</span>
              <span className="font-bold text-on-surface">{(order.distanceM / 1000).toFixed(1)} km</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Driver:</span>
              <span className="font-medium text-on-surface">{order.driverId ? "Sedang menuju lokasi" : "Mencari driver..."}</span>
            </div>
          </div>
          
          {order.status === "COMPLETED" && (
            <button 
              onClick={() => navigate("/customer")}
              className="w-full mt-4 h-12 bg-primary-container text-[#052E16] text-[16px] font-bold rounded-full hover:bg-primary-container/90 transition-all"
            >
              Kembali ke Beranda
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
