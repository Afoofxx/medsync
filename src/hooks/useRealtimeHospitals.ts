import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Hospital } from '@/types';
import { parsePoint } from '@/lib/utils';

export function useRealtimeHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from('hospitals')
        .select('*, hospital_resources(*)')
        .eq('is_active', true);
      if (!mounted || !data) return;
      setHospitals(data.map((h: any) => ({
        ...h,
        location: parsePoint(h.location) ?? { lat: 0, lng: 0 },
        resources: h.hospital_resources?.[0] ?? h.hospital_resources,
      })));
      setLoading(false);
    }
    load();

    const chan = supabase
      .channel('rt-hospitals')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hospitals' }, (payload) => {
        setHospitals(prev => prev.map(h => h.id === (payload.new as any).id
          ? { ...h, ...payload.new, location: parsePoint((payload.new as any).location) ?? h.location } : h));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hospital_resources' }, (payload) => {
        const row: any = payload.new;
        setHospitals(prev => prev.map(h => h.id === row.hospital_id ? { ...h, resources: row } : h));
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(chan); };
  }, []);

  return { hospitals, loading };
}
