import {
  Hospital as HospitalIcon, Bed, Heart, Siren, Stethoscope, Wind, Scan,
  Droplet, Cross, Truck, Bell
} from 'lucide-react';
import { Counter, Chip } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeAmbulances } from '@/hooks/useRealtimeAmbulances';
import { useRealtimeHospitals } from '@/hooks/useRealtimeHospitals';
import { useRealtimeIncidents, useRealtimeDispatches } from '@/hooks/useRealtimeIncidents';
import { supabase, logActivity } from '@/lib/supabase';
import { cn, fallbackEtaMin } from '@/lib/utils';
import { PRIORITY_META, INCIDENT_TYPE_LABEL } from '@/types';
import type { EDStatus, HospitalResources } from '@/types';

export default function HospitalPage() {
  const { profile } = useAuth();
  const { hospitals } = useRealtimeHospitals();
  const { ambulances } = useRealtimeAmbulances();
  const { incidents } = useRealtimeIncidents();
  const { dispatches } = useRealtimeDispatches();

  const hospital = hospitals.find(h => h.id === profile?.hospital_id);

  if (!hospital) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 p-8 text-center">
        <div>
          <HospitalIcon className="w-12 h-12 mx-auto text-slate-700" />
          <p className="mt-3 text-sm">This account is not linked to a hospital. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  const R = hospital.resources!;
  const incoming = dispatches
    .filter(d => d.hospital_id === hospital.id && ['en_route', 'on_scene', 'transporting'].includes(d.stage))
    .map(d => {
      const inc = incidents.find(i => i.id === d.incident_id);
      const amb = ambulances.find(a => a.id === d.ambulance_id);
      if (!inc || !amb) return null;
      return { dispatch: d, incident: inc, ambulance: amb, etaMin: amb.location ? fallbackEtaMin(amb.location, hospital.location) : 0 };
    })
    .filter(Boolean) as any[];

  async function updateResource(key: keyof HospitalResources, delta: number) {
    const cur = R[key];
    if (typeof cur !== 'number') return;
    const next = Math.max(0, cur + delta);
    await supabase.from('hospital_resources')
      .update({ [key]: next, updated_at: new Date().toISOString(), updated_by: profile?.id })
      .eq('hospital_id', hospital.id);
    await logActivity('resource.update', 'hospital_resources', hospital.id, { key, value: next });
  }

  async function toggleFeature(key: 'trauma_bay' | 'ct_available' | 'mri_available') {
    await supabase.from('hospital_resources').update({ [key]: !R[key] }).eq('hospital_id', hospital.id);
    await logActivity('resource.toggle', 'hospital_resources', hospital.id, { key, value: !R[key] });
  }

  async function setEDStatus(s: EDStatus) {
    await supabase.from('hospitals').update({ ed_status: s }).eq('id', hospital.id);
    await logActivity('hospital.ed_status', 'hospitals', hospital.id, { status: s });
  }

  const bloodTypes: [string, number, keyof HospitalResources][] = [
    ['O', R.blood_o, 'blood_o'], ['A', R.blood_a, 'blood_a'],
    ['B', R.blood_b, 'blood_b'], ['AB', R.blood_ab, 'blood_ab']
  ];

  return (
    <div className="h-full grid grid-cols-[1fr_360px] gap-3 p-3">
      <main className="rounded-2xl border border-white/5 bg-slate-950/70 overflow-y-auto">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center ring-1 ring-emerald-500/30">
              <HospitalIcon className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white text-lg font-bold">{hospital.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{hospital.area}</p>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">ED Status</div>
            <div className="flex rounded-lg bg-slate-900 p-1 text-xs">
              {(['open', 'busy', 'diversion'] as EDStatus[]).map(s => {
                const active = R && hospital.ed_status === s;
                const color = s === 'open' ? 'bg-emerald-500 text-white' : s === 'busy' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white';
                return (
                  <button key={s} onClick={() => setEDStatus(s)}
                    className={cn('px-3 py-1.5 rounded-md font-semibold uppercase tracking-wider text-[10px]', active ? color : 'text-slate-400 hover:text-white')}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Bed Capacity</h3>
            <div className="grid grid-cols-3 gap-3">
              <Counter icon={Bed} label="Available Beds" value={R.beds} onDelta={d => updateResource('beds', d)} tone="cyan" />
              <Counter icon={Heart} label="ICU Beds" value={R.icu} onDelta={d => updateResource('icu', d)} tone="rose" />
              <Counter icon={Siren} label="Emergency" value={R.emergency} onDelta={d => updateResource('emergency', d)} tone="amber" />
            </div>
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Critical Care</h3>
            <div className="grid grid-cols-3 gap-3">
              <Counter icon={Stethoscope} label="Operating Theatres" value={R.theatres} onDelta={d => updateResource('theatres', d)} tone="violet" />
              <Counter icon={Wind} label="Ventilators" value={R.ventilators} onDelta={d => updateResource('ventilators', d)} tone="cyan" />
              <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-2">
                  <Cross className="w-3.5 h-3.5" /> Trauma Bay
                </div>
                <button onClick={() => toggleFeature('trauma_bay')}
                  className={cn('mt-2 w-full rounded-lg py-3 font-bold text-sm',
                    R.trauma_bay ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40' : 'bg-slate-800 text-slate-500')}>
                  {R.trauma_bay ? 'ACTIVE' : 'INACTIVE'}
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Imaging</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['ct_available', 'CT Scanner'], ['mri_available', 'MRI']].map(([key, label]) => (
                <div key={key} className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-2">
                      <Scan className="w-3.5 h-3.5" /> {label}
                    </div>
                    <button onClick={() => toggleFeature(key as any)}
                      className={cn('rounded-md px-3 py-1 text-[11px] font-bold',
                        (R as any)[key] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500')}>
                      {(R as any)[key] ? 'ONLINE' : 'DOWN'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Blood Bank (units)</h3>
            <div className="grid grid-cols-4 gap-3">
              {bloodTypes.map(([label, val, key]) => (
                <Counter key={label} icon={Droplet} label={`Type ${label}`} value={val}
                  onDelta={d => updateResource(key, d)} tone="rose" small />
              ))}
            </div>
          </section>
        </div>
      </main>

      <aside className="rounded-2xl border border-white/5 bg-slate-950/70 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Incoming</div>
            <div className="text-white text-lg font-bold mt-0.5">{incoming.length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/30">
            <Siren className="w-5 h-5 text-amber-400" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {incoming.length === 0 && <div className="text-center text-slate-500 text-xs py-8">No incoming patients</div>}
          {incoming.map(item => {
            const s = PRIORITY_META[item.incident.priority];
            return (
              <div key={item.dispatch.id} className={cn('rounded-xl border p-3 ring-1', s.ring, 'bg-slate-900/60 border-white/5')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-bold">{item.ambulance.call_sign}</div>
                      <div className="text-[10px] text-slate-500">{item.incident.code}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-cyan-400 tabular-nums">{item.etaMin}</div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">min ETA</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Chip className={cn(s.bg, s.text)}>{s.label}</Chip>
                    <span className="text-[11px] text-slate-300">{INCIDENT_TYPE_LABEL[item.incident.type]}</span>
                  </div>
                  {item.dispatch.patient_note && (
                    <div className="text-[11px] text-slate-400 bg-slate-950/70 rounded-md p-2 border border-white/5">
                      {item.dispatch.patient_note}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Origin: {item.incident.address?.split(',')[0]}</span>
                  <span className="capitalize">{item.dispatch.stage.replace('_', ' ')}</span>
                </div>
                <button className="mt-3 w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs text-white font-semibold flex items-center justify-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Prep Team
                </button>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
