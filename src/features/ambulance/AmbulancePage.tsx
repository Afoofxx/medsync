import {
  Truck, Fuel, Wifi, Navigation, Users, Check, X, Circle, MapPin,
  PhoneCall, Building2, Radio
} from 'lucide-react';
import { LiveMap } from '@/components/map/LiveMap';
import { Button, Chip } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeAmbulances } from '@/hooks/useRealtimeAmbulances';
import { useRealtimeHospitals } from '@/hooks/useRealtimeHospitals';
import { useRealtimeIncidents, useRealtimeDispatches } from '@/hooks/useRealtimeIncidents';
import { useGeoTracker } from '@/hooks/useGeoTracker';
import { supabase, logActivity } from '@/lib/supabase';
import { launchNavigation } from '@/lib/maps';
import { fmtAgo, cn } from '@/lib/utils';
import { PRIORITY_META, INCIDENT_TYPE_LABEL, STATUS_META } from '@/types';
import type { AmbulanceStatus, MissionStage } from '@/types';

export default function AmbulancePage() {
  const { profile } = useAuth();
  const { ambulances } = useRealtimeAmbulances();
  const { hospitals } = useRealtimeHospitals();
  const { incidents } = useRealtimeIncidents();
  const { dispatches } = useRealtimeDispatches();

  const ambulance = ambulances.find(a => a.id === profile?.ambulance_id);
  const dispatch = dispatches.find(d => d.ambulance_id === profile?.ambulance_id && d.stage !== 'completed' && d.stage !== 'cancelled');
  const incident = dispatch ? incidents.find(i => i.id === dispatch.incident_id) : undefined;
  const hospital = dispatch?.hospital_id ? hospitals.find(h => h.id === dispatch.hospital_id) : undefined;

  useGeoTracker(profile?.ambulance_id, ambulance?.status ?? 'offline');

  if (!ambulance || !profile?.ambulance_id) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 p-8 text-center">
        <div>
          <Truck className="w-12 h-12 mx-auto text-slate-700" />
          <p className="mt-3 text-sm">This account is not linked to an ambulance unit. Contact your control center.</p>
        </div>
      </div>
    );
  }

  const isPending = dispatch?.stage === 'pending';
  const isActive = dispatch && !['pending', 'completed', 'cancelled'].includes(dispatch.stage);

  const nextStage: Record<MissionStage, { next: MissionStage; label: string; icon: any } | null> = {
    pending: null,
    accepted: { next: 'en_route', label: 'Start Response', icon: Navigation },
    en_route: { next: 'on_scene', label: 'Arrived On Scene', icon: MapPin },
    on_scene: { next: 'transporting', label: 'Patient Loaded', icon: Truck },
    transporting: { next: 'at_hospital', label: 'Arrived Hospital', icon: Building2 },
    at_hospital: { next: 'completed', label: 'Handoff Complete', icon: Check },
    completed: null, cancelled: null,
  };

  async function setStatus(s: AmbulanceStatus) {
    await supabase.from('ambulances').update({ status: s }).eq('id', ambulance!.id);
    await logActivity('ambulance.status', 'ambulances', ambulance!.id, { status: s });
  }

  async function accept() {
    if (!dispatch || !incident) return;
    await supabase.from('dispatches').update({ stage: 'en_route', accepted_at: new Date().toISOString() }).eq('id', dispatch.id);
    await supabase.from('ambulances').update({ status: 'en_route' }).eq('id', ambulance!.id);
    await supabase.from('incidents').update({ status: 'in_progress' }).eq('id', incident.id);
    await supabase.from('notifications').insert({ recipient_role: 'control', kind: 'status', title: 'Dispatch Accepted', body: `${ambulance!.call_sign} en route` });
    await logActivity('dispatch.accept', 'dispatches', dispatch.id);
    launchNavigation(incident.location, ambulance!.location);
  }

  async function reject(reason: string = 'declined') {
    if (!dispatch || !incident) return;
    await supabase.from('dispatches').update({ stage: 'cancelled', rejected_reason: reason }).eq('id', dispatch.id);
    await supabase.from('ambulances').update({ status: 'available' }).eq('id', ambulance!.id);
    await supabase.from('incidents').update({ status: 'reported' }).eq('id', incident.id);
    await supabase.from('notifications').insert({ recipient_role: 'control', kind: 'alert', title: 'Dispatch Rejected', body: `${ambulance!.call_sign} rejected — needs re-assignment` });
    await logActivity('dispatch.reject', 'dispatches', dispatch.id, { reason });
  }

  async function progress(stage: MissionStage) {
    if (!dispatch || !incident) return;
    const now = new Date().toISOString();
    const patch: any = { stage };
    if (stage === 'on_scene') patch.on_scene_at = now;
    if (stage === 'transporting') patch.transporting_at = now;
    if (stage === 'at_hospital') patch.arrived_hospital_at = now;
    if (stage === 'completed') patch.completed_at = now;
    await supabase.from('dispatches').update(patch).eq('id', dispatch.id);

    if (stage === 'transporting') {
      await supabase.from('ambulances').update({ status: 'transporting' }).eq('id', ambulance!.id);
      await supabase.from('incidents').update({ status: 'transporting' }).eq('id', incident.id);
      if (hospital) launchNavigation(hospital.location, ambulance!.location);
    } else if (stage === 'on_scene') {
      await supabase.from('ambulances').update({ status: 'on_scene' }).eq('id', ambulance!.id);
    } else if (stage === 'at_hospital') {
      await supabase.from('ambulances').update({ status: 'at_hospital' }).eq('id', ambulance!.id);
    } else if (stage === 'completed') {
      await supabase.from('ambulances').update({ status: 'available' }).eq('id', ambulance!.id);
      await supabase.from('incidents').update({ status: 'completed', completed_at: now }).eq('id', incident.id);
      await supabase.from('notifications').insert({ recipient_role: 'control', kind: 'status', title: 'Mission Complete', body: `${ambulance!.call_sign} available` });
    }
    await logActivity(`dispatch.${stage}`, 'dispatches', dispatch.id);
  }

  async function requestBackup() {
    await supabase.from('notifications').insert({
      recipient_role: 'control', kind: 'alert',
      title: 'BACKUP REQUESTED', body: `${ambulance!.call_sign} needs support at ${incident?.address ?? 'scene'}`
    });
    await logActivity('backup.request', 'ambulances', ambulance!.id);
  }

  const stageInfo = dispatch ? nextStage[dispatch.stage] : null;

  return (
    <div className="h-full grid grid-cols-[1fr_360px] gap-3 p-3">
      <main className="rounded-2xl border border-white/5 bg-slate-950/70 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 flex items-center justify-center ring-1 ring-cyan-500/30">
              <Truck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <div className="text-white text-lg font-bold tracking-wider">{ambulance.call_sign}</div>
              <div className="text-xs text-slate-400 mt-0.5">{profile.full_name} · {ambulance.base_station}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400"><Fuel className="w-3.5 h-3.5" /> {ambulance.fuel_pct}%</div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400"><Wifi className="w-3.5 h-3.5" /> Live</div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-white/5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Unit Status</div>
          <div className="grid grid-cols-3 gap-2">
            {(['available', 'dispatched', 'offline'] as AmbulanceStatus[]).map(s => {
              const active = ambulance.status === s;
              const color = STATUS_META[s].color;
              return (
                <button key={s} onClick={() => setStatus(s)}
                  className={cn('rounded-xl py-3 font-semibold text-sm transition', active ? 'text-white' : 'text-slate-400 bg-slate-900 hover:bg-slate-800')}
                  style={active ? { background: `${color}25`, boxShadow: `inset 0 0 0 1px ${color}66` } : {}}>
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: color }} />{STATUS_META[s].label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {dispatch && incident ? (
          <div className="p-5 flex-1 overflow-y-auto">
            <div className={cn('rounded-2xl border-2 p-5', isPending ? 'border-amber-500/50 bg-amber-500/5 animate-pulse-slow' : 'border-white/5 bg-slate-900/60')}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Chip className={cn(PRIORITY_META[incident.priority].bg, PRIORITY_META[incident.priority].text)}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_META[incident.priority].dot)} />
                      {PRIORITY_META[incident.priority].label}
                    </Chip>
                    <span className="text-[11px] text-slate-500 font-mono">{incident.code}</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-white">{INCIDENT_TYPE_LABEL[incident.type]}</h2>
                  <div className="mt-1 text-slate-400 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {incident.address}</div>
                </div>
                {isPending && (
                  <div className="text-right">
                    <div className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Dispatch Alert</div>
                    <div className="text-white text-sm mt-1">Respond within 60s</div>
                  </div>
                )}
              </div>

              {incident.description && (
                <div className="mt-4 rounded-lg bg-slate-950/70 p-3 border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Details</div>
                  <div className="text-sm text-slate-200 mt-1">{incident.description}</div>
                </div>
              )}

              {incident.caller_phone && (
                <div className="mt-3">
                  <a href={`tel:${incident.caller_phone}`} className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-950/70 border border-white/5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-900">
                    <PhoneCall className="w-4 h-4 text-emerald-400" /> {incident.caller_phone}
                  </a>
                </div>
              )}

              {hospital && (
                <div className="mt-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Destination Hospital</div>
                  <div className="mt-1 flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">{hospital.short_name}</div>
                      <div className="text-xs text-slate-400">{hospital.name}</div>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => launchNavigation(hospital.location, ambulance.location)}>
                      <Navigation className="w-3.5 h-3.5" /> Route
                    </Button>
                  </div>
                </div>
              )}

              {isPending ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button variant="default" size="lg" className="py-4" onClick={() => reject()}><X className="w-5 h-5" /> Reject</Button>
                  <Button variant="success" size="lg" className="py-4" onClick={accept}><Check className="w-5 h-5" /> Accept Dispatch</Button>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => launchNavigation(incident.location, ambulance.location)}>
                      <Navigation className="w-4 h-4 text-cyan-400" /> Open Maps
                    </Button>
                    <Button onClick={requestBackup}>
                      <Users className="w-4 h-4 text-amber-400" /> Request Backup
                    </Button>
                  </div>
                  {stageInfo && (
                    <Button variant="primary" size="lg" className="w-full py-5" onClick={() => progress(stageInfo.next)}>
                      <stageInfo.icon className="w-5 h-5" />
                      <span className="text-lg">{stageInfo.label}</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isActive && (
              <div className="mt-5 rounded-xl bg-slate-900/60 border border-white/5 p-4">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Mission Timeline</div>
                <div className="space-y-3">
                  {[
                    { key: 'accepted', label: 'Dispatched', at: dispatch.accepted_at },
                    { key: 'on_scene', label: 'On Scene', at: dispatch.on_scene_at },
                    { key: 'transporting', label: 'Transporting', at: dispatch.transporting_at },
                    { key: 'at_hospital', label: 'At Hospital', at: dispatch.arrived_hospital_at },
                  ].map(s => (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', s.at ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-500')}>
                        {s.at ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                      </div>
                      <div className="flex-1">
                        <div className={cn('text-sm font-medium', s.at ? 'text-white' : 'text-slate-500')}>{s.label}</div>
                        {s.at && <div className="text-[11px] text-slate-500">{fmtAgo(s.at)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-900 flex items-center justify-center mb-4">
              <Radio className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-white">Standing By</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">No active mission. Awaiting dispatch.</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Available
            </div>
          </div>
        )}
      </main>

      <aside className="rounded-2xl border border-white/5 bg-slate-950/70 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/5">
          <div className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Live Position</div>
          <div className="text-white text-sm mt-0.5">{ambulance.base_station}</div>
        </div>
        <div className="flex-1 bg-[#050a14]">
          <LiveMap
            ambulances={[ambulance]}
            hospitals={hospital ? [hospital] : []}
            incidents={incident ? [incident] : []}
            center={ambulance.location}
            zoom={13}
          />
        </div>
      </aside>
    </div>
  );
}
