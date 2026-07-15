// ============================================================
// Free maps stack — no API keys, no credit card required.
//   Tiles:     CartoDB Dark Matter (via OpenStreetMap)
//   Autocomplete: Nominatim
//   Routing:   OSRM public API
//   Launch nav: Google Maps universal URL (no key needed)
// ============================================================
import type { LatLng } from '@/types';

export const DEFAULT_CENTER: LatLng = {
  lat: parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT ?? '6.5244'),
  lng: parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG ?? '3.3792'),
};
export const DEFAULT_ZOOM = parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM ?? '11');

export const TILE_URL_DARK =
  'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png';
export const TILE_URL_LIGHT =
  'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Lagos metropolitan bounds
export const LAGOS_BOUNDS = {
  north: 6.7028, south: 6.3934, east: 3.6437, west: 3.1226,
};

// ----- Nominatim (geocoding + autocomplete) -----------------------
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Autocomplete: text query -> best matching Lagos places */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<NominatimResult[]> {
  if (!q.trim() || q.trim().length < 3) return [];
  const viewbox = `${LAGOS_BOUNDS.west},${LAGOS_BOUNDS.north},${LAGOS_BOUNDS.east},${LAGOS_BOUNDS.south}`;
  const url = `${NOMINATIM}/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ng&viewbox=${viewbox}&bounded=1&limit=6&addressdetails=1`;
  try {
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal,
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Reverse geocode: coords -> best matching address */
export async function reverseGeocode(loc: LatLng): Promise<string | null> {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&zoom=17`);
    if (!r.ok) return null;
    const data = await r.json();
    return data.display_name ?? null;
  } catch { return null; }
}

// ----- OSRM (routing & ETAs) --------------------------------------
const OSRM = 'https://router.project-osrm.org';

export interface OSRMRoute {
  duration_min: number;
  distance_km: number;
  geometry: [number, number][]; // [lat, lng] pairs for Leaflet Polyline
}

/** Get a road-following route between two points */
export async function getRoute(from: LatLng, to: LatLng): Promise<OSRMRoute | null> {
  try {
    const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const route = data.routes?.[0];
    if (!route) return null;
    // GeoJSON is [lng, lat]; Leaflet wants [lat, lng]
    const geom: [number, number][] = (route.geometry.coordinates as [number, number][])
      .map(([lng, lat]) => [lat, lng]);
    return {
      duration_min: Math.max(1, Math.round(route.duration / 60)),
      distance_km: +(route.distance / 1000).toFixed(1),
      geometry: geom,
    };
  } catch { return null; }
}

/** Quick ETA-only lookup (no polyline) */
export async function getEta(from: LatLng, to: LatLng): Promise<number | null> {
  try {
    const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const sec = data.routes?.[0]?.duration;
    return sec ? Math.max(1, Math.round(sec / 60)) : null;
  } catch { return null; }
}

// ----- Nav launcher -----------------------------------------------
/** Open Google Maps with turn-by-turn directions (universal URL, no API key required). */
export function launchNavigation(dest: LatLng, origin?: LatLng) {
  const destStr = `${dest.lat},${dest.lng}`;
  const q = new URLSearchParams({
    api: '1',
    destination: destStr,
    travelmode: 'driving',
    dir_action: 'navigate',
  });
  if (origin) q.set('origin', `${origin.lat},${origin.lng}`);
  window.open(`https://www.google.com/maps/dir/?${q.toString()}`, '_blank', 'noopener');
}

/** Get current geolocation as LatLng */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation unsupported'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(e),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}
