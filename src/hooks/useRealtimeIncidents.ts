import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Incident, Dispatch } from '@/types';
import { parsePoint } from '@/lib/utils';

function mapIncident(row: any): Incident {
  return { ...row, location: parsePoint(row.location) ?? { lat: 0, lng: 0 } };
}

export function useRealtimeIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('incidents').select('*').order('reported_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (data) setIncidents(data.map(mapIncident));
        setLoading(false);
      });

    const chan = supabase
      .channel('rt-incidents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, (payload) => {
        setIncidents(prev => {
          if (payload.eventType === 'INSERT') return [mapIncident(payload.new), ...prev];
          if (payload.eventType === 'UPDATE') return prev.map(i => i.id === (payload.new as any).id ? mapIncident(payload.new) : i);
          if (payload.eventType === 'DELETE') return prev.filter(i => i.id !== (payload.old as any).id);
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, []);

  return { incidents, loading };
}

export function useRealtimeDispatches() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('dispatches').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (data) setDispatches(data); setLoading(false); });

    const chan = supabase
      .channel('rt-dispatches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatches' }, (payload) => {
        setDispatches(prev => {
          if (payload.eventType === 'INSERT') return [payload.new as Dispatch, ...prev];
          if (payload.eventType === 'UPDATE') return prev.map(d => d.id === (payload.new as any).id ? payload.new as Dispatch : d);
          if (payload.eventType === 'DELETE') return prev.filter(d => d.id !== (payload.old as any).id);
          return prev;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, []);

  return { dispatches, loading };
}
