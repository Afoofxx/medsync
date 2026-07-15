import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Ambulance, LatLng } from '@/types';
import { parsePoint } from '@/lib/utils';

export function useRealtimeAmbulances() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initial() {
      const { data: ambs } = await supabase.from('ambulances').select('*').eq('is_active', true);
      const { data: locs } = await supabase.from('v_ambulance_current').select('*');
      if (!mounted || !ambs) return;
      const locMap = new Map<string, LatLng>();
      (locs ?? []).forEach((l: any) => {
        locMap.set(l.ambulance_id, { lat: l.lat, lng: l.lng });
      });
      setAmbulances(ambs.map((a: any) => ({ ...a, location: locMap.get(a.id) })));
      setLoading(false);
    }
    initial();

    const chan = supabase
      .channel('rt-ambulances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, (payload) => {
        setAmbulances(prev => {
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Ambulance];
          if (payload.eventType === 'UPDATE') return prev.map(a => a.id === (payload.new as any).id ? { ...a, ...(payload.new as Ambulance) } : a);
          if (payload.eventType === 'DELETE') return prev.filter(a => a.id !== (payload.old as any).id);
          return prev;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ambulance_locations' }, (payload) => {
        const row: any = payload.new;
        const loc = parsePoint(row.location);
        if (!loc) return;
        setAmbulances(prev => prev.map(a => a.id === row.ambulance_id ? { ...a, location: loc, heading: row.heading, speed_kmh: row.speed_kmh } : a));
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(chan); };
  }, []);

  return { ambulances, loading };
}
