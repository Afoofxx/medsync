import { useMemo, useState, useEffect } from 'react';
import {
  Activity, Bed, Building2, ChevronDown, ChevronRight, Filter, Radio,
  Settings, Siren, Timer, Truck, MapPin
} from 'lucide-react';
import { LiveMap } from '@/components/map/LiveMap';
import { Button, Chip, StatCard, Modal, ModalHeader, Loader } from '@/components/ui';
import { PlacesAutocomplete, type PlaceResult } from '@/components/ui/PlacesAutocomplete';
import { useRealtimeAmbulances } from '@/hooks/useRealtimeAmbulances';
import { useRealtimeHospitals } from '@/hooks/useRealtimeHospitals';
import { useRealtimeIncidents, useRealtimeDispatches } from '@/hooks/useRealtimeIncidents';
import { supabase, logActivity } from '@/lib/supabase';
import { rankAmbulancesAsync, rankHospitalsAsync } from '@/lib/dispatch-engine';
import { getRoute } from '@/lib/maps';
import { fmtAgo, cn } from '@/lib/utils';
import { PRIORITY_META, INCIDENT_TYPE_LABEL } from '@/types';
import type { Incident, RankedOption, IncidentType, Priority, DispatchWeights } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ControlCenterPage() {
  const { ambulances } = useRealtimeAmbulances();
  const { hospitals } = useRealtimeHospitals();
  const { incidents } = useRealtimeIncidents();
  const { dispatches } = useRealtimeDispatches();

  const [incidentModal, setIncidentModal] = useState(false);
  const [dispatchFor, setDispatchFor] = useState<Incident | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [selectedAmbId, setSelectedAmbId] = useState<string | undefined>();
  const [showWeights, setShowWeights] = useState(false);
  const [route, setRoute] = useState<[number, number][] | undefined>();
  const [weights, setWeights] = useState<DispatchWeights>({
    weight_travel: 40, weight_traffic: 20, weight_capacity: 15,
    weight_specialty: 15, weight_priority: 10, auto_dispatch: false,
  });

  useEffect(() => {
    supabase.from('dispatch_config').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setWeights(data as any);
    });
  }, []);

  // Draw route for the first active mission
  useEffect(() => {
    const active = dispatches.find(d => ['en_route', 'transporting'].includes(d.stage));
    if (!active) { setRoute(undefined); return; }
    const amb = ambulances.find(a => a.id === active.ambulance_id);
    let target = null;
    if (active.stage === 'en_route') {
      const inc = incidents.find(i => i.id === active.incident_id);
      target = inc?.location;
    } else {
      const h = hospitals.find(h => h.id === active.hospital_id);
      target = h?.location;
    }
    if (amb?.location && target) {
      getRoute(amb.location, target).then(r => setRoute(r?.geometry));
    }
  }, [dispatches, ambulances, incidents, hospitals]);

  const active = dispatches.filter(d => d.stage !== 'completed' && d.stage !== 'cancelled');
  const availAmbulances = ambulances.filter(a => a.status === 'available').length;
  const totalBeds = hospitals.reduce((s, h) => s + (h.resources?.beds ?? 0), 0);
  const totalICU = hospitals.reduce((s, h) => s + (h.resources?.icu ?? 0), 0);
  const pendingIncidents = incidents.filter(i => i.status === 'reported' || i.status === 'dispatching');

  const filteredIncidents = incidents.filter(i => {
    if (filter === 'active') return i.status === 'in_progress' || i.status === 'transporting' || i.status === 'assigned';
    if (filter === 'pending') return i.status === 'reported' || i.status === 'dispatching';
    return true;
  }).slice(0, 50);

  const kpiHistory = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => ({
      t: `${String(i).padStart(2, '0')}:00`,
      response: 6 + Math.sin(i / 3) * 2 + Math.random() * 1.5,
    })), []);

  async function saveWeights(next: DispatchWeights) {
    setWeights(next);
    await supabase.from('dispatch_config').update(next).eq('id', 1);
  }

  async function createIncident(payload: any) {
    const { data, error } = await supabase.from('incidents').insert({
      type: payload.type,
      priority: payload.priority,
      location: `POINT(${payload.location.lng} ${payload.location.lat})`,
      address: payload.address,
      caller_name: payload.callerName,
      caller_phone: payload.callerPhone,
      description: payload.description,
    }).select().single();
    if (error) { alert(error.message); return null; }
    await logActivity('incident.create', 'incidents', data.id);
    return data;
  }

  async function confirmDispatch(incident: Incident, ambId: string, hospId: string) {
    const { error } = await supabase.from('dispatches').insert({
      incident_id: incident.id, ambulance_id: ambId, hospital_id: hospId,
    });
    if (error) return alert(error.message);
    await supabase.from('incidents').update({ status: 'assigned' }).eq('id', incident.id);
    await supabase.from('ambulances').update({ status: 'dispatched' }).eq('id', ambId);
    await supabase.from('notifications').insert([
      { recipient_role: 'ambulance', kind: 'dispatch', title: 'New Dispatch', body: `${INCIDENT_TYPE_LABEL[incident.type]} · ${incident.address ?? ''}` },
      { recipient_role: 'hospital', kind: 'incoming', title: 'Inbound Patient', body: `${INCIDENT_TYPE_LABEL[incident.type]} en route` },
    ]);
    await logActivity('dispatch.create', 'dispatches', undefined, { incident_id: incident.id, ambulance_id: ambId, hospital_id: hospId });
    setDispatchFor(null);
  }

  return (
    <div className="h-full grid grid-cols-[300px_1fr_340px] gap-3 p-3">
      {/* LEFT PANEL */}
      <aside className="rounded-2xl border border-white/5 bg-slate-950/70 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <Button variant="danger" size="lg" className="w-full" onClick={() => setIncidentModal(true)}>
            <Siren className="w-5 h-5" /> New Incident
          </Button>
        </div>

        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Incidents</span>
          <div className="flex rounded-md bg-slate-900 p-0.5 text-[10px]">
            {(['all', 'active', 'pending'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-2 py-0.5 rounded', filter === f ? 'bg-slate-700 text-white' : 'text-slate-400')}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-2">
          {filteredIncidents.length === 0 && <div className="text-center text-slate-500 text-xs py-8">No incidents</div>}
          {filteredIncidents.map(i => {
            const meta = PRIORITY_META[i.priority];
            const dsp = dispatches.find(d => d.incident_id === i.id);
            const amb = dsp && ambulances.find(a => a.id === dsp.ambulance_id);
            return (
              <div key={i.id}
                className={cn('rounded-lg border p-3 cursor-pointer transition ring-1', meta.ring, 'bg-slate-900/60 border-white/5 hover:bg-slate-900')}>
                <div className="flex items-center justify-between">
                  <Chip className={cn(meta.bg, meta.text)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />{meta.label}
                  </Chip>
                  <span className="text-[10px] text-slate-500 font-mono">{i.code}</span>
                </div>
                <div className="mt-2 text-sm text-white font-medium">{INCIDENT_TYPE_LABEL[i.type]}</div>
                <div className="text-xs text-slate-400 truncate">{i.address}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{fmtAgo(i.reported_at)}</span>
                  {amb ? (
                    <span className="text-[10px] text-amber-400 font-semibold">{amb.call_sign}</span>
                  ) : (
                    <button onClick={() => setDispatchFor(i)}
                      className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      Dispatch <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/5 p-3">
          <button onClick={() => setShowWeights(!showWeights)}
            className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
            <span className="flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Dispatch Weights</span>
            <ChevronDown className={cn('w-3.5 h-3.5 transition', showWeights && 'rotate-180')} />
          </button>
          {showWeights && (
            <div className="mt-3 space-y-2">
              {(['weight_travel', 'weight_traffic', 'weight_capacity', 'weight_specialty', 'weight_priority'] as const).map(k => (
                <div key={k}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 capitalize">{k.replace('weight_', '')}</span>
                    <span className="text-cyan-400 tabular-nums">{weights[k]}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={weights[k]}
                    onChange={e => saveWeights({ ...weights, [k]: parseInt(e.target.value) })}
                    className="w-full accent-cyan-500 h-1" />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* MAP */}
      <main className="rounded-2xl border border-white/5 bg-slate-950/70 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-white">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <span className="text-sm font-semibold">Lagos Operational Grid</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>{ambulances.length} units · {hospitals.length} hospitals · {active.length} active</span>
          </div>
        </div>

        <div className="flex-1 relative bg-[#050a14]">
          <LiveMap
            ambulances={ambulances} hospitals={hospitals} incidents={incidents}
            selectedAmbulanceId={selectedAmbId}
            onAmbulanceClick={setSelectedAmbId}
            route={route}
          />
        </div>

        <div className="grid grid-cols-4 gap-2 p-3 border-t border-white/5">
          <StatCard icon={Timer} label="Avg Response" value="6.4 min" delta="↓ 12%" tone="good" />
          <StatCard icon={Activity} label="Active Missions" value={active.length} delta={`${pendingIncidents.length} pending`} tone="warn" />
          <StatCard icon={Truck} label="Fleet Available" value={`${availAmbulances}/${ambulances.length}`} />
          <StatCard icon={Bed} label="ED Beds" value={totalBeds} delta={`${totalICU} ICU`} tone="good" />
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside className="rounded-2xl border border-white/5 bg-slate-950/70 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Response Time (24h)</div>
          <div className="h-24 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpiHistory}>
                <defs>
                  <linearGradient id="rt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide /><YAxis hide />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="response" stroke="#22d3ee" strokeWidth={2} fill="url(#rt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 text-[11px] uppercase tracking-widest text-slate-500 font-semibold flex items-center justify-between">
          <span>Active Missions</span><span className="text-cyan-400">{active.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
          {active.length === 0 && <div className="text-center text-slate-500 text-xs py-6">No active missions</div>}
          {active.map(d => {
            const inc = incidents.find(i => i.id === d.incident_id);
            const amb = ambulances.find(a => a.id === d.ambulance_id);
            const hosp = hospitals.find(h => h.id === d.hospital_id);
            if (!inc || !amb) return null;
            const stages = ['pending', 'accepted', 'en_route', 'on_scene', 'transporting', 'at_hospital'];
            const stageIdx = stages.indexOf(d.stage);
            return (
              <div key={d.id} className="rounded-lg bg-slate-900/70 border border-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{amb.call_sign}</span>
                  <Chip className={cn(PRIORITY_META[inc.priority].bg, PRIORITY_META[inc.priority].text)}>{PRIORITY_META[inc.priority].label}</Chip>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">{inc.address}</div>
                {hosp && <div className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1"><Building2 className="w-3 h-3" />{hosp.short_name}</div>}
                <div className="mt-2 flex gap-0.5">
                  {stages.map((_, i) => <div key={i} className={cn('h-1 flex-1 rounded-full', i <= stageIdx ? 'bg-cyan-500' : 'bg-slate-700')} />)}
                </div>
                <div className="mt-1 text-[10px] text-slate-500 capitalize">{d.stage.replace('_', ' ')}</div>
              </div>
            );
          })}
        </div>
      </aside>

      {incidentModal && (
        <IncidentModal
          onClose={() => setIncidentModal(false)}
          onCreate={async (payload) => {
            const created = await createIncident(payload);
            setIncidentModal(false);
            if (created) setDispatchFor(created);
          }}
        />
      )}
      {dispatchFor && (
        <DispatchModal
          incident={dispatchFor}
          ambulances={ambulances}
          hospitals={hospitals}
          weights={weights}
          onClose={() => setDispatchFor(null)}
          onDispatch={(ambId, hospId) => confirmDispatch(dispatchFor, ambId, hospId)}
        />
      )}
    </div>
  );
}

// ============================================================
// Incident Modal
// ============================================================
function IncidentModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: any) => void }) {
  const [type, setType] = useState<IncidentType>('accident');
  const [priority, setPriority] = useState<Priority>('high');
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [callerName, setCallerName] = useState('');
  const [callerPhone, setCallerPhone] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Modal open onClose={onClose}>
      <ModalHeader
        title="Report New Incident"
        subtitle="Priority dispatch will be recommended"
        onClose={onClose}
        icon={<div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center ring-1 ring-red-500/40"><Siren className="w-5 h-5 text-red-400" /></div>}
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Type</label>
            <select value={type} onChange={e => setType(e.target.value as IncidentType)}
              className="mt-1 w-full bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-white text-sm">
              {(Object.keys(INCIDENT_TYPE_LABEL) as IncidentType[]).map(t => (
                <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Priority</label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
                const m = PRIORITY_META[p];
                return (
                  <button key={p} onClick={() => setPriority(p)}
                    className={cn('rounded-lg py-2.5 text-[10px] font-bold tracking-wider', priority === p ? cn(m.bg, m.text, 'ring-1', m.ring) : 'bg-slate-900 text-slate-500')}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Incident Location
          </label>
          <div className="mt-1">
            <PlacesAutocomplete
              value={place}
              onChange={setPlace}
              placeholder="Search for an address in Lagos…"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">Powered by OpenStreetMap. Select from suggestions to lock exact GPS coordinates.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input value={callerName} onChange={e => setCallerName(e.target.value)} placeholder="Caller name"
            className="bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-white text-sm" />
          <input value={callerPhone} onChange={e => setCallerPhone(e.target.value)} placeholder="Caller phone"
            className="bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-white text-sm" />
        </div>

        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Nature of emergency, casualties, hazards…"
          className="w-full bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-white text-sm resize-none" />
      </div>
      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!place}
          onClick={() => onCreate({
            type, priority, location: place!.location, address: place!.address,
            callerName, callerPhone, description,
          })}>
          Create & Dispatch
        </Button>
      </div>
    </Modal>
  );
}

// ============================================================
// Dispatch Modal — client-side scoring with OSRM
// ============================================================
function DispatchModal({ incident, ambulances, hospitals, weights, onClose, onDispatch }: {
  incident: Incident; ambulances: any[]; hospitals: any[]; weights: DispatchWeights;
  onClose: () => void; onDispatch: (ambId: string, hospId: string) => void;
}) {
  const [ranked, setRanked] = useState<{ ambulances: RankedOption[]; hospitals: RankedOption[] } | null>(null);
  const [selectedAmb, setSelectedAmb] = useState<string | undefined>();
  const [selectedHosp, setSelectedHosp] = useState<string | undefined>();
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    (async () => {
      const a = await rankAmbulancesAsync(incident, ambulances, weights);
      const bestAmb = ambulances.find(x => x.id === a[0]?.id);
      const h = await rankHospitalsAsync(incident, hospitals, bestAmb?.location ?? incident.location, weights);
      setRanked({ ambulances: a, hospitals: h });
      setSelectedAmb(a[0]?.id);
      setSelectedHosp(h[0]?.id);
      setBusy(false);
    })();
  }, [incident.id]);

  return (
    <Modal open onClose={onClose} maxWidth="max-w-4xl">
      <ModalHeader
        title="Smart Dispatch"
        subtitle={`${INCIDENT_TYPE_LABEL[incident.type]} · ${incident.address ?? ''}`}
        onClose={onClose}
      />
      {busy ? <Loader label="Computing traffic-adjusted ETAs via OSRM…" /> : (
        <div className="grid grid-cols-2 gap-0 flex-1 overflow-hidden">
          <div className="border-r border-white/5 overflow-y-auto">
            <div className="px-6 py-3 border-b border-white/5 sticky top-0 bg-slate-950 z-10">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> Ambulances</div>
            </div>
            <div className="p-3 space-y-2">
              {ranked?.ambulances.map((r, idx) => {
                const a = ambulances.find(x => x.id === r.id);
                if (!a) return null;
                return (
                  <button key={r.id} onClick={() => setSelectedAmb(r.id)}
                    className={cn('w-full text-left rounded-lg border p-3 transition',
                      selectedAmb === r.id ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/40' : 'bg-slate-900/60 border-white/5 hover:bg-slate-900')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Chip className="bg-emerald-500/15 text-emerald-400">BEST</Chip>}
                        <span className="text-white font-semibold text-sm">{a.call_sign}</span>
                      </div>
                      <span className="text-2xl font-bold text-cyan-400 tabular-nums">{r.score}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.reasons.slice(0, 3).map((rr, i) => <span key={i} className="text-[10px] bg-slate-800 rounded px-1.5 py-0.5 text-slate-400">{rr}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-y-auto">
            <div className="px-6 py-3 border-b border-white/5 sticky top-0 bg-slate-950 z-10">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-2"><Building2 className="w-3.5 h-3.5" /> Hospitals</div>
            </div>
            <div className="p-3 space-y-2">
              {ranked?.hospitals.map((r, idx) => {
                const h = hospitals.find(x => x.id === r.id);
                if (!h) return null;
                return (
                  <button key={r.id} onClick={() => setSelectedHosp(r.id)}
                    className={cn('w-full text-left rounded-lg border p-3 transition',
                      selectedHosp === r.id ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/40' : 'bg-slate-900/60 border-white/5 hover:bg-slate-900')}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Chip className="bg-emerald-500/15 text-emerald-400">BEST</Chip>}
                        <div>
                          <div className="text-white font-semibold text-sm">{h.short_name}</div>
                          <div className="text-[10px] text-slate-400">{h.area}</div>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-cyan-400 tabular-nums">{r.score}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.reasons.slice(0, 3).map((rr, i) => <span key={i} className="text-[10px] bg-slate-800 rounded px-1.5 py-0.5 text-slate-400">{rr}</span>)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-2 bg-slate-950">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!selectedAmb || !selectedHosp}
          onClick={() => onDispatch(selectedAmb!, selectedHosp!)}>
          <Radio className="w-4 h-4" /> Confirm Dispatch
        </Button>
      </div>
    </Modal>
  );
}
