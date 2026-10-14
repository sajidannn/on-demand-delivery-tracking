import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/api/client';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { useAuth } from '../../contexts/AuthContext';
import { io, Socket } from 'socket.io-client';
import { fetchOSRMRoute, getAddressFromCoordinates } from '../../lib/geo';
import { driverIcon, pickupIcon, dropoffIcon } from '../../lib/map-icons';
import OrderStatusBadge from '../../components/OrderStatusBadge';

function MapController({
  driverLocation,
}: {
  driverLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const hasInitiallyCentered = useRef(false);
  const lat = driverLocation?.lat;
  const lng = driverLocation?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;

    if (!hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      map.flyTo([lat, lng], 16, {
        animate: true,
        duration: 1.2,
      });
    } else {
      map.panTo([lat, lng], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [map, lat, lng]);

  return null;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  // Riwayat perjalanan driver (abu-abu)
  const [traveledPath, setTraveledPath] = useState<[number, number][]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('driver_traveled_path');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [dropoffAddress, setDropoffAddress] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Browser tidak mendukung GPS'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error('Gagal mengambil GPS: ' + err.message)),
      );
    });
  };

  const fetchOrders = async () => {
    try {
      const { data, error: apiError } = await apiClient.GET('/orders');
      if (apiError) {
        setError(String(apiError.message || 'Gagal memuat pesanan'));
      } else if (data) {
        const activeOrders = Array.isArray(data)
          ? data.filter(
              (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED',
            )
          : [];
        setOrders(activeOrders);

        // Fetch addresses for the first active order
        const activeOrder = activeOrders[0];
        if (activeOrder) {
          getAddressFromCoordinates(
            activeOrder.pickup.lat,
            activeOrder.pickup.lng,
          ).then(setPickupAddress);
          getAddressFromCoordinates(
            activeOrder.dropoff.lat,
            activeOrder.dropoff.lng,
          ).then(setDropoffAddress);
        }
      }
    } catch {
      setError('Kesalahan jaringan saat memuat pesanan');
    }
  };

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- polling pesanan saat mount
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update Route when driver moves or order changes
  useEffect(() => {
    const activeOrder = orders[0];
    if (activeOrder && driverLocation) {
      // If DRIVER_ASSIGNED, route to pickup. If PICKED_UP, route to dropoff.
      const target =
        activeOrder.status === 'DRIVER_ASSIGNED'
          ? activeOrder.pickup
          : activeOrder.dropoff;
      fetchOSRMRoute(driverLocation, target).then(setRoutePath);
    } else {
      // oxlint-disable-next-line react/set-state-in-effect -- reset rute saat tak ada order aktif
      setRoutePath([]);
    }
  }, [driverLocation, orders]);

  useEffect(() => {
    let watchId: number;
    let socket: Socket | null = null;

    if (isOnline) {
      // Connect WS
      socket = io(
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : '/',
        {
          withCredentials: true,
          transports: ['websocket', 'polling'],
        },
      );

      // Notifikasi pembatalan order oleh customer
      socket.on('order:status', (payload: { orderId: string; status: string }) => {
        if (payload.status === 'CANCELLED') {
          setOrders((prev) => {
            const stillHeld = prev.some((o) => o.id === payload.orderId);
            if (stillHeld) {
              setToast('Order dibatalkan oleh customer');
            }
            return prev.filter((o) => o.id !== payload.orderId);
          });
        }
      });

      // Watch GPS Location
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const newCoord: [number, number] = [lat, lng];
          setDriverLocation({ lat, lng });
          // Catat riwayat jejak perjalanan
          setTraveledPath((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const dLat = Math.abs(last[0] - newCoord[0]);
              const dLng = Math.abs(last[1] - newCoord[1]);
              if (dLat < 0.00001 && dLng < 0.00001) return prev;
            }
            const updated = [...prev, newCoord];
            try {
              sessionStorage.setItem('driver_traveled_path', JSON.stringify(updated));
            } catch {
              // ignore
            }
            return updated;
          });

          // Send ping to server
          if (socket?.connected) {
            const activeOrder = orders[0];
            socket.emit('driver:location', {
              lat,
              lng,
              orderId: activeOrder?.id,
            });
          }
        },
        (err) => console.error('Gagal mendapatkan lokasi:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (socket) socket.disconnect();
    };
  }, [isOnline, orders]);

  // oxlint-disable-next-line react/no-set-state-in-render-effect -- auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleOnline = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      if (isOnline) {
        const { error: apiError } = await apiClient.POST('/drivers/offline');
        if (apiError) throw apiError;
        setIsOnline(false);
        setDriverLocation(null);
      } else {
        const loc = await getCurrentLocation();
        const { error: apiError } = await apiClient.POST('/drivers/online', {
          body: loc,
        });
        if (apiError) throw apiError;
        setDriverLocation(loc);
        setIsOnline(true);
      }
    } catch (err: any) {
      setError(String(err.message || 'Gagal mengubah status'));
    } finally {
      setIsUpdating(false);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: 'PICKED_UP' | 'COMPLETED',
  ) => {
    setIsUpdating(true);
    try {
      const { error: apiError } = await apiClient.PATCH('/orders/{id}/status', {
        params: { path: { id: orderId } },
        body: { status },
      });
      if (apiError) throw apiError;
      await fetchOrders();
    } catch (err: any) {
      setError(String(err.message || 'Gagal mengubah status pesanan'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-surface-container-low">
      <MapContainer
        center={driverLocation ? [driverLocation.lat, driverLocation.lng] : [-6.9147, 107.6098]}
        zoom={14}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Auto Camera Follow to Driver GPS */}
        <MapController driverLocation={driverLocation} />
        
        {/* Driver Marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
        )}

        {/* Active Order Markers & Route */}
        {orders[0] && (
          <>
            <Marker position={[orders[0].pickup.lat, orders[0].pickup.lng]} icon={pickupIcon} />
            <Marker position={[orders[0].dropoff.lat, orders[0].dropoff.lng]} icon={dropoffIcon} />
          </>
        )}

        {/* Riwayat Perjalanan Driver (Traveled History - Abu-abu) */}
        {traveledPath.length > 1 && (
          <>
            <Polyline 
              positions={traveledPath} 
              color="#1e293b" 
              weight={7}
              opacity={0.4}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline 
              positions={traveledPath} 
              color="#475569" 
              weight={4}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {routePath.length > 0 && (
          <>
            <Polyline 
              positions={routePath} 
              color="#004b1e" 
              weight={8}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline 
              positions={routePath} 
              color="#3B82F6" 
              weight={4}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline 
              positions={routePath} 
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

      {/* Floating Top Panel (Status & Profile) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-10 flex flex-col gap-4">
        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-[16px] text-[14px] shadow-level-2">
            {error}
          </div>
        )}
        {toast && (
          <div className="bg-on-surface text-surface p-4 rounded-[16px] text-[14px] shadow-level-3">
            {toast}
          </div>
        )}
        <div className="bg-surface-container-lowest rounded-[24px] shadow-level-3 p-5 sm:p-6 border border-surface-container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-bold text-on-surface tracking-[-0.02em]">
                Halo, {user?.name}
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-1">
                {isOnline
                  ? 'Anda online & siap menerima order.'
                  : 'Anda sedang offline.'}
              </p>
            </div>
            <button
              onClick={toggleOnline}
              disabled={isUpdating}
              className={`h-12 px-6 text-[14px] font-bold rounded-full transition-all flex items-center justify-center min-w-[100px] shadow-level-1 ${
                isOnline
                  ? 'bg-error text-on-error hover:bg-error/90'
                  : 'bg-primary-container text-on-primary-container hover:bg-primary-container/90'
              }`}
            >
              {isUpdating ? '...' : isOnline ? 'Offline' : 'Online'}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Panel (Active Orders) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-10 max-h-[50vh] overflow-y-auto hide-scrollbar">
        {orders.length === 0 ? (
          <div className="bg-surface-container-lowest/90 backdrop-blur-md rounded-[24px] p-6 text-center border border-surface-container shadow-level-3">
            <p className="text-[14px] font-medium text-on-surface-variant">
              {isOnline ? 'Menunggu pesanan masuk...' : 'Aktifkan status Online untuk mulai.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-surface-container-lowest rounded-[24px] shadow-level-3 p-5 sm:p-6 border border-surface-container"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="mb-2">
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-[12px] text-on-surface-variant font-mono">
                      ID: {order.id.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[18px] font-bold text-on-surface">
                      Rp{order.fee.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[12px] text-on-surface-variant">
                      {(order.distanceM / 1000).toFixed(1)} km
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-6 bg-surface-container-low p-4 rounded-[16px]">
                  <div className="flex gap-3">
                    <div className="w-3 h-3 mt-1 rounded-full border-2 border-primary-container shrink-0" />
                    <div>
                      <p className="text-[12px] text-on-surface-variant mb-1">
                        Titik Jemput
                      </p>
                      <p className="text-[14px] font-medium text-on-surface truncate">
                        {pickupAddress ||
                          `${order.pickup.lat.toFixed(5)}, ${order.pickup.lng.toFixed(5)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 mt-1 rounded-full bg-error shrink-0" />
                    <div>
                      <p className="text-[12px] text-on-surface-variant mb-1">
                        Titik Tujuan
                      </p>
                      <p className="text-[14px] font-medium text-on-surface truncate">
                        {dropoffAddress ||
                          `${order.dropoff.lat.toFixed(5)}, ${order.dropoff.lng.toFixed(5)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {order.status === 'DRIVER_ASSIGNED' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'PICKED_UP')}
                      disabled={isUpdating}
                      className="flex-1 h-12 bg-primary text-on-primary text-[14px] font-bold rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Pesanan Diambil
                    </button>
                  )}
                  {order.status === 'PICKED_UP' && (
                    <button
                      onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
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
    </div>
  );
}
