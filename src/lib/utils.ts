import { clsx, type ClassValue } from 'clsx';
import type { LatLng } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function fmtAgo(ts: string | number | Date): string {
  const d = new Date(ts).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Haversine distance in km
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Rough ETA at 30 km/h city average (fallback when Distance Matrix unavailable)
export function fallbackEtaMin(a: LatLng, b: LatLng, avgSpeedKmh = 30): number {
  return Math.max(1, Math.round((haversineKm(a, b) / avgSpeedKmh) * 60));
}

// Parse PostGIS point (either GeoJSON object or WKT) to LatLng
export function parsePoint(pt: any): LatLng | undefined {
  if (!pt) return undefined;
  if (pt.coordinates) return { lat: pt.coordinates[1], lng: pt.coordinates[0] };
  if (typeof pt === 'string' && pt.startsWith('POINT')) {
    const m = /POINT\(([-\d.]+)\s+([-\d.]+)\)/.exec(pt);
    if (m) return { lat: parseFloat(m[2]), lng: parseFloat(m[1]) };
  }
  return undefined;
}
