import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { AmbulanceStatus } from '@/types';

/**
 * Streams GPS position to ambulance_locations while the ambulance is not offline.
 * Uses watchPosition + throttled inserts (every ~5s or on significant move).
 */
export function useGeoTracker(ambulanceId: string | undefined, status: AmbulanceStatus) {
  const watcherId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!ambulanceId || status === 'offline' || status === 'maintenance') {
      if (watcherId.current !== null) navigator.geolocation.clearWatch(watcherId.current);
      watcherId.current = null;
      return;
    }
    if (!navigator.geolocation) return;

    watcherId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const cur = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const moved = !lastPos.current || Math.abs(cur.lat - lastPos.current.lat) > 0.0002 || Math.abs(cur.lng - lastPos.current.lng) > 0.0002;
        if (now - lastSent.current < 4000 && !moved) return;

        supabase.from('ambulance_locations').insert({
          ambulance_id: ambulanceId,
          location: `POINT(${cur.lng} ${cur.lat})`,
          heading: pos.coords.heading ?? null,
          speed_kmh: pos.coords.speed ? pos.coords.speed * 3.6 : null,
          accuracy_m: pos.coords.accuracy,
        });
        lastSent.current = now;
        lastPos.current = cur;
      },
      (err) => console.warn('[geo]', err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      if (watcherId.current !== null) navigator.geolocation.clearWatch(watcherId.current);
      watcherId.current = null;
    };
  }, [ambulanceId, status]);
}
