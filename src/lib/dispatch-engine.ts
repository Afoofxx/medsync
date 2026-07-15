import type { Ambulance, Hospital, Incident, RankedOption, DispatchWeights, LatLng } from '@/types';
import { fallbackEtaMin } from './utils';
import { getEta } from './maps';

/**
 * Smart dispatch scoring. Tries OSRM road-based ETAs first (free public API);
 * falls back to haversine + 30km/h city average if OSRM is unreachable.
 * Adds a rush-hour multiplier as a rough traffic proxy.
 */

function rushHourFactor(): number {
  const h = new Date().getHours();
  if ((h >= 7 && h <= 10) || (h >= 16 && h <= 20)) return 1.6; // heavy rush
  if ((h >= 6 && h <= 11) || (h >= 15 && h <= 21)) return 1.25; // moderate
  return 1.0;
}

async function bestEta(from: LatLng, to: LatLng): Promise<number> {
  const osrm = await getEta(from, to);
  if (osrm) return Math.round(osrm * rushHourFactor());
  return Math.round(fallbackEtaMin(from, to) * rushHourFactor());
}

export async function rankAmbulancesAsync(
  incident: Incident,
  ambulances: Ambulance[],
  weights: DispatchWeights
): Promise<RankedOption[]> {
  const eligible = ambulances.filter(a => a.status === 'available' && a.location);

  const scored = await Promise.all(eligible.map(async a => {
    const etaMin = await bestEta(a.location!, incident.location);
    const reasons: string[] = [`ETA ${etaMin} min (traffic-adjusted)`];
    let score = 100 - Math.min(60, etaMin * (weights.weight_travel / 20));

    if (a.capabilities.includes('ALS')) { score += 15; reasons.push('ALS capable'); }
    if ((incident.type === 'trauma' || incident.type === 'accident') && a.capabilities.includes('trauma')) {
      score += 15; reasons.push('Trauma equipped');
    }
    if (incident.priority === 'critical') { score += weights.weight_priority / 4; reasons.push('Priority boost'); }
    if (a.fuel_pct < 30) { score -= 10; reasons.push('Low fuel'); }

    return { id: a.id, score: Math.round(score), eta_min: etaMin, reasons };
  }));

  return scored.sort((x, y) => y.score - x.score);
}

export async function rankHospitalsAsync(
  incident: Incident,
  hospitals: Hospital[],
  refPoint: LatLng,
  weights: DispatchWeights
): Promise<RankedOption[]> {
  const eligible = hospitals.filter(h => h.ed_status !== 'diversion' && h.is_active && h.resources && h.resources.beds > 0);

  const scored = await Promise.all(eligible.map(async h => {
    const etaMin = await bestEta(refPoint, h.location);
    const reasons: string[] = [`ETA ${etaMin} min`];
    const r = h.resources!;
    let score = 100 - Math.min(60, etaMin * (weights.weight_travel / 15));

    const capacity = Math.min(30, r.beds + r.emergency * 2);
    score += capacity * (weights.weight_capacity / 100);
    reasons.push(`${r.beds} beds · ${r.icu} ICU`);

    let specialty = 0;
    if ((incident.type === 'trauma' || incident.type === 'accident') && h.specialties.includes('trauma')) specialty = 25;
    if (incident.type === 'cardiac' && h.specialties.includes('cardiac')) specialty = 25;
    if (incident.type === 'stroke' && h.specialties.includes('stroke')) specialty = 25;
    if (incident.type === 'obstetric' && h.specialties.includes('obstetric')) specialty = 25;
    if (specialty > 0) { score += specialty * (weights.weight_specialty / 100); reasons.push('Specialty match'); }

    if (h.ed_status === 'busy') { score -= 15; reasons.push('ED busy'); }
    if (r.trauma_bay) { score += 5; reasons.push('Trauma bay ready'); }
    if (r.ct_available && (incident.type === 'stroke' || incident.type === 'trauma')) {
      score += 5; reasons.push('CT online');
    }

    return { id: h.id, score: Math.round(score), eta_min: etaMin, reasons };
  }));

  return scored.sort((x, y) => y.score - x.score);
}
