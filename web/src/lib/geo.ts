import type { LatLngTuple } from 'leaflet';

/**
 * Konversi [lng, lat] dari backend/GeoJSON ke [lat, lng] Leaflet
 */
export function toLatLng(lngLat: [number, number]): LatLngTuple {
  return [lngLat[1], lngLat[0]];
}

/**
 * Konversi [lat, lng] Leaflet ke [lng, lat] untuk backend/GeoJSON
 */
export function toLngLat(latLng: LatLngTuple): [number, number] {
  return [latLng[1], latLng[0]];
}

/**
 * Konversi array of [lng, lat] ke array of [lat, lng] (LatLngTuple)
 */
export function toLatLngArray(lngLats: [number, number][]): LatLngTuple[] {
  return lngLats.map(toLatLng);
}

// Simple in-memory cache to avoid redundant API calls
const addressCache = new Map<string, string>();

/**
 * Mendapatkan nama jalan/lokasi dari koordinat via Nominatim OSM.
 */
export async function getAddressFromCoordinates(
  lat: number,
  lng: number,
): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (addressCache.has(key)) {
    return addressCache.get(key)!;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'id',
        },
      },
    );
    if (!response.ok) throw new Error('Failed to fetch address');

    const data = await response.json();

    // Fallback: road, suburb, city, or display_name
    let address =
      data.address?.road || data.address?.neighbourhood || data.address?.suburb;
    if (address && data.address?.city) {
      address += `, ${data.address.city}`;
    }

    const finalAddress =
      address ||
      data.display_name.split(',')[0] ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    addressCache.set(key, finalAddress);
    return finalAddress;
  } catch (error) {
    console.error('Geocoding error:', error);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; // Fallback to coords
  }
}

/**
 * Mendapatkan jalur (polyline) rute dari OSRM.
 */
export async function fetchOSRMRoute(start: {lat: number, lng: number}, end: {lat: number, lng: number}): Promise<[number, number][]> {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return [];
    
    return data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
  } catch (e) {
    console.error('OSRM error:', e);
    return [];
  }
}
