import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { io } from 'socket.io-client';
import { apiClient } from '../../lib/api/client';
import { fetchOSRMRoute, getAddressFromCoordinates } from '../../lib/geo';
import { driverIcon, pickupIcon, dropoffIcon } from '../../lib/map-icons';
import { OrderStatusBadge, getOrderStatusInfo } from '../../lib/order-status';

function MapController({
  driverLocation,
  autoFollow,
  onUserDrag,
}: {
  driverLocation: { lat: number; lng: number } | null;
  autoFollow: boolean;
  onUserDrag: () => void;
}) {
  const map = useMap();
  const hasInitiallyCentered = useRef(false);

  useMapEvents({
    dragstart() {
      onUserDrag();
    },
  });

  useEffect(() => {
    if (!driverLocation || !autoFollow) return;

    if (!hasInitiallyCentered.current) {
      hasInitiallyCentered.current = true;
      map.flyTo([driverLocation.lat, driverLocation.lng], 16, {
        animate: true,
        duration: 1.2,
      });
    } else {
      map.panTo([driverLocation.lat, driverLocation.lng], {
        animate: true,
        duration: 0.8,
      });
    }
  }, [map, driverLocation?.lat, driverLocation?.lng, autoFollow]);

  return null;
}

export default function CustomerTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  // Riwayat rute yang sudah dilalui driver (warna abu-abu)
  const [traveledPath, setTraveledPath] = useState<[number, number][]>(() => {
    if (typeof window !== 'undefined' && orderId) {
      try {
        const saved = sessionStorage.getItem(`traveled_path_${orderId}`);
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore JSON parse error
      }
    }
    return [];
  });
  const traveledPathRef = useRef<[number, number][]>(traveledPath);
  traveledPathRef.current = traveledPath;

  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [dropoffAddress, setDropoffAddress] = useState<string>('');
  const [autoFollow, setAutoFollow] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    // Fetch initial order details
    const fetchOrder = async () => {
      try {
        const { data, error: apiError } = await apiClient.GET('/orders/{id}', {
          params: { path: { id: orderId } },
        });
        if (apiError) throw apiError;
        setOrder(data);
        
        if (data) {
          getAddressFromCoordinates(data.pickup.lat, data.pickup.lng).then(setPickupAddress);
          getAddressFromCoordinates(data.dropoff.lat, data.dropoff.lng).then(setDropoffAddress);
        }
      } catch (err) {
        setError('Gagal memuat detail pesanan');
      }
    };
    fetchOrder();

    // Connect WebSocket
    // Since we use HttpOnly cookies, we rely on withCredentials
    const socketInstance = io(
      window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/',
      {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      },
    );

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      // Subscribe to this order's updates
      socketInstance.emit('order:subscribe', { orderId });
    });

    socketInstance.on('order:status', (data) => {
      console.log('Status update:', data);
      setOrder((prev: any) => (prev ? { ...prev, status: data.status } : null));
    });

    socketInstance.on('order:location', (data: { lat: number; lng: number }) => {
      console.log('Driver location update:', data);
      const newCoord: [number, number] = [data.lat, data.lng];
      setDriverLocation({ lat: data.lat, lng: data.lng });

      // Catat jejak riwayat rute perjalanan
      setTraveledPath((prev) => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          const dLat = Math.abs(last[0] - newCoord[0]);
          const dLng = Math.abs(last[1] - newCoord[1]);
          // Jangan duplikasi jika koordinat sama persis / micro-jitter (< ~1 meter)
          if (dLat < 0.00001 && dLng < 0.00001) {
            return prev;
          }
        }
        const updated = [...prev, newCoord];
        if (typeof window !== 'undefined' && orderId) {
          try {
            sessionStorage.setItem(`traveled_path_${orderId}`, JSON.stringify(updated));
          } catch {
            // ignore storage limit error
          }
        }
        return updated;
      });
    });

    socketInstance.on('exception', (err) => {
      console.error('WS Exception:', err);
    });

    // Store in ref or just let it close on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [orderId]);

  // Update Route when driverLocation or status changes
  useEffect(() => {
    if (!order) return;
    
    const calculateRoute = async () => {
      if (order.status === "PENDING") {
        const path = await fetchOSRMRoute(order.pickup, order.dropoff);
        setRoutePath(path);
      } else if (order.status === "DRIVER_ASSIGNED" && driverLocation) {
        const path = await fetchOSRMRoute(driverLocation, order.pickup);
        setRoutePath(path);
      } else if (order.status === "PICKED_UP" && driverLocation) {
        const path = await fetchOSRMRoute(driverLocation, order.dropoff);
        setRoutePath(path);

        // Jika user baru buka halaman saat pesanan sudah PICKED_UP dan belum ada riwayat lokal
        if (traveledPathRef.current.length === 0) {
          fetchOSRMRoute(order.pickup, driverLocation).then((pastPath) => {
            if (pastPath.length > 0 && traveledPathRef.current.length === 0) {
              setTraveledPath(pastPath);
              if (orderId) {
                try {
                  sessionStorage.setItem(`traveled_path_${orderId}`, JSON.stringify(pastPath));
                } catch {
                  // ignore
                }
              }
            }
          });
        }
      } else if (order.status === "COMPLETED") {
        // Ketika pesanan selesai, sisa rute aktif jadi kosong
        setRoutePath([]);
        // Pastikan seluruh rute pickup -> dropoff tampil sebagai riwayat abu-abu
        if (traveledPathRef.current.length === 0) {
          const path = await fetchOSRMRoute(order.pickup, order.dropoff);
          setTraveledPath(path);
          if (orderId) {
            try {
              sessionStorage.setItem(`traveled_path_${orderId}`, JSON.stringify(path));
            } catch {
              // ignore
            }
          }
        }
      } else {
        const path = await fetchOSRMRoute(order.pickup, order.dropoff);
        setRoutePath(path);
      }
    };
    calculateRoute();
  }, [order?.status, driverLocation?.lat, driverLocation?.lng, orderId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] bg-surface">
        <div className="bg-error-container text-on-error-container p-6 rounded-[24px] max-w-md text-center">
          <h2 className="text-[20px] font-bold mb-2">Oops!</h2>
          <p>{error}</p>
          <button
            onClick={() => navigate('/customer')}
            className="mt-6 px-6 py-2 bg-on-error-container text-error-container rounded-full font-bold"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        Memuat pesanan...
      </div>
    );
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

        {/* Riwayat Perjalanan Driver (Traveled History - Abu-abu) */}
        {traveledPath.length > 1 && (
          <>
            {/* Outline gelap untuk kontras di atas peta */}
            <Polyline 
              positions={traveledPath} 
              color="#1e293b" 
              weight={7}
              opacity={0.4}
              lineCap="round"
              lineJoin="round"
            />
            {/* Garis riwayat abu-abu gelap */}
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

        {/* Dynamic Live Route (Hijau - Rute Aktif Menuju Tujuan) */}
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
              color="#22c55e" 
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

        {/* Pickup & Dropoff Markers */}
        <Marker position={[order.pickup.lat, order.pickup.lng]} icon={pickupIcon} />
        <Marker position={[order.dropoff.lat, order.dropoff.lng]} icon={dropoffIcon} />

        {/* Driver Marker */}
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} />
        )}

        {/* Auto Camera Follow to Driver GPS */}
        <MapController
          driverLocation={driverLocation}
          autoFollow={autoFollow}
          onUserDrag={() => setAutoFollow(false)}
        />
      </MapContainer>

      {/* Floating Re-center Button when user manually dragged */}
      {!autoFollow && driverLocation && (
        <button
          onClick={() => setAutoFollow(true)}
          className="absolute bottom-6 right-6 z-10 px-4 py-2.5 bg-surface-container-lowest text-primary border border-surface-container shadow-level-2 rounded-full font-bold text-[13px] flex items-center gap-2 hover:bg-surface-container-low transition-all cursor-pointer"
        >
          <span>🎯</span> Pusatkan ke Driver
        </button>
      )}

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
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="space-y-2 mb-2 bg-surface-container-low p-4 rounded-[16px]">
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Harga:</span>
              <span className="font-bold text-on-surface">
                Rp{order.fee.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Jarak:</span>
              <span className="font-bold text-on-surface">
                {(order.distanceM / 1000).toFixed(1)} km
              </span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-on-surface-variant">Driver:</span>
              <span className="font-medium text-on-surface">
                {order.driverId
                  ? getOrderStatusInfo(order.status).customerDescription
                  : 'Mencari kurir...'}
              </span>
            </div>
            {pickupAddress && (
              <div className="flex justify-between text-[14px] pt-1 border-t border-surface-container">
                <span className="text-on-surface-variant shrink-0 mr-2">Jemput:</span>
                <span className="font-medium text-on-surface truncate text-right" title={pickupAddress}>
                  {pickupAddress}
                </span>
              </div>
            )}
            {dropoffAddress && (
              <div className="flex justify-between text-[14px]">
                <span className="text-on-surface-variant shrink-0 mr-2">Tujuan:</span>
                <span className="font-medium text-on-surface truncate text-right" title={dropoffAddress}>
                  {dropoffAddress}
                </span>
              </div>
            )}

            {/* Indikator Rute & Riwayat */}
            {traveledPath.length > 1 && (
              <div className="flex items-center gap-4 text-[12px] text-on-surface-variant pt-2 mt-2 border-t border-surface-container">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-1 rounded-full bg-[#475569] inline-block shadow-sm" />
                  <span>Riwayat Perjalanan</span>
                </div>
                {routePath.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-1 rounded-full bg-emerald-500 inline-block shadow-sm" />
                    <span>Rute Tujuan</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {order.status === 'COMPLETED' && (
            <button
              onClick={() => navigate('/customer')}
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
