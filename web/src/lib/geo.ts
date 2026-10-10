import type { LatLngTuple } from "leaflet";

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
