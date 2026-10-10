import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from "react-leaflet";
import { apiClient } from "../../lib/api/client";
import { useAuth } from "../../contexts/AuthContext";

type LatLng = { lat: number; lng: number };

function MapEvents({ onMapClick }: { onMapClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMapClick = (latlng: LatLng) => {
    if (!pickup || (pickup && dropoff)) {
      setPickup(latlng);
      setDropoff(null);
      setEstimate(null);
      setError(null);
    } else {
      setDropoff(latlng);
    }
  };

  useEffect(() => {
    if (pickup && dropoff) {
      fetchEstimate();
    }
  }, [pickup, dropoff]);

  const fetchEstimate = async () => {
    if (!pickup || !dropoff) return;
    
    setIsEstimating(true);
    setError(null);
    try {
      const { data, error: apiError } = await apiClient.POST("/orders/estimate", {
        body: { pickup, dropoff },
      });

      if (apiError) {
        setError(apiError.message ? String(apiError.message) : "Gagal mendapatkan estimasi");
      } else if (data) {
        setEstimate(data);
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setIsEstimating(false);
    }
  };

  const handleOrder = async () => {
    if (!pickup || !dropoff || !estimate) return;
    
    setIsOrdering(true);
    try {
      const { data, error: apiError } = await apiClient.POST("/orders", {
        body: { pickup, dropoff },
      });

      if (apiError) {
        setError(apiError.message ? String(apiError.message) : "Gagal membuat pesanan");
      } else if (data) {
        navigate(`/customer/track/${data.id}`);
      }
    } catch (err) {
      setError("Terjadi kesalahan saat memesan");
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-surface-container-low">
      <MapContainer
        center={[-6.9147, 107.6098]} // Bandung
        zoom={13}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapEvents onMapClick={handleMapClick} />
        
        {pickup && <Marker position={[pickup.lat, pickup.lng]} />}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} />}
        
        {/* Render actual route from OSRM if available, otherwise fallback to straight line */}
        {pickup && dropoff && estimate?.route?.coordinates ? (
          <>
            {/* Outline / Shadow layer (Block jalan) */}
            <Polyline 
              positions={estimate.route.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])} 
              color="#004b1e" 
              weight={8}
              lineCap="round"
              lineJoin="round"
            />
            {/* Main Fill layer */}
            <Polyline 
              positions={estimate.route.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])} 
              color="#22c55e" 
              weight={4}
              lineCap="round"
              lineJoin="round"
            />
            {/* Animated Direction Flow layer (Arah) */}
            <Polyline 
              positions={estimate.route.coordinates.map((coord: [number, number]) => [coord[1], coord[0]])} 
              color="#ffffff" 
              weight={3}
              dashArray="6, 18"
              opacity={0.8}
              lineCap="round"
              lineJoin="round"
              className="animate-route-flow"
            />
          </>
        ) : pickup && dropoff && (
          <Polyline 
            positions={[[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]} 
            color="#22C55E" 
            weight={4} 
            dashArray="10, 10" 
          />
        )}
      </MapContainer>

      {/* Floating Panel */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-10">
        <div className="bg-surface-container-lowest rounded-[24px] shadow-level-3 p-5 sm:p-6 border border-surface-container">
          
          <div className="mb-4">
            <h2 className="text-[20px] font-bold text-on-surface tracking-[-0.02em]">
              Mau kirim kemana hari ini?
            </h2>
            <p className="text-[14px] text-on-surface-variant mt-1">
              {!pickup 
                ? "Tap peta untuk memilih lokasi penjemputan" 
                : !dropoff 
                ? "Tap peta untuk memilih lokasi tujuan" 
                : "Lokasi sudah dipilih"}
            </p>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-primary-container bg-surface-container-lowest shrink-0" />
              <div className="flex-1 h-[48px] px-4 bg-surface-container-low border border-surface-container-highest rounded-[20px] flex items-center">
                <span className={`text-[14px] truncate ${pickup ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
                  {pickup ? `${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}` : "Pilih Penjemputan..."}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-error shrink-0" />
              <div className="flex-1 h-12 px-4 bg-surface-container-low border border-surface-container-highest rounded-[20px] flex items-center">
                <span className={`text-[14px] truncate ${dropoff ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
                  {dropoff ? `${dropoff.lat.toFixed(5)}, ${dropoff.lng.toFixed(5)}` : "Pilih Tujuan..."}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-[14px] text-on-error-container bg-error-container p-3 rounded-[12px]">
              {error}
            </div>
          )}

          {isEstimating && (
            <div className="flex items-center justify-center py-4 text-on-surface-variant text-[14px]">
              Menghitung rute...
            </div>
          )}

          {estimate && !isEstimating && (
            <div className="bg-surface-container-low rounded-[16px] p-4 mb-5 border border-surface-container-highest">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[14px] text-on-surface-variant">Estimasi Harga</span>
                <span className="text-[20px] font-bold text-on-surface">
                  Rp{estimate.fee.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-on-surface-variant">Jarak</span>
                <span className="text-[14px] font-semibold text-on-surface">
                  {(estimate.distanceM / 1000).toFixed(1)} km
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleOrder}
            disabled={!estimate || isOrdering}
            className="w-full h-12 flex items-center justify-center bg-primary-container text-[#052E16] text-[16px] font-bold rounded-full hover:bg-primary-container/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isOrdering ? "Memproses..." : "Pesan Sekarang"}
          </button>

        </div>
      </div>
    </div>
  );
}
