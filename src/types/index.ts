// ============================================================
// MedSync — shared types
// ============================================================

export type UserRole = 'control' | 'ambulance' | 'hospital' | 'super_admin';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type IncidentType = 'cardiac' | 'trauma' | 'stroke' | 'obstetric' | 'accident' | 'respiratory' | 'other';
export type IncidentStatus = 'reported' | 'dispatching' | 'assigned' | 'in_progress' | 'transporting' | 'completed' | 'cancelled';
export type AmbulanceStatus = 'available' | 'dispatched' | 'en_route' | 'on_scene' | 'transporting' | 'at_hospital' | 'offline' | 'maintenance';
export type MissionStage = 'pending' | 'accepted' | 'en_route' | 'on_scene' | 'transporting' | 'at_hospital' | 'completed' | 'cancelled';
export type EDStatus = 'open' | 'busy' | 'diversion';

export interface LatLng { lat: number; lng: number; }

export interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  hospital_id?: string;
  ambulance_id?: string;
  station?: string;
  is_active: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  short_name: string;
  area?: string;
  address?: string;
  location: LatLng;
  phone?: string;
  specialties: string[];
  ed_status: EDStatus;
  is_active: boolean;
  resources?: HospitalResources;
}

export interface HospitalResources {
  hospital_id: string;
  beds: number;
  icu: number;
  emergency: number;
  theatres: number;
  ventilators: number;
  blood_o: number;
  blood_a: number;
  blood_b: number;
  blood_ab: number;
  trauma_bay: boolean;
  ct_available: boolean;
  mri_available: boolean;
  updated_at: string;
}

export interface Ambulance {
  id: string;
  call_sign: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  base_station?: string;
  capabilities: string[];
  status: AmbulanceStatus;
  fuel_pct: number;
  is_active: boolean;
  location?: LatLng;
  heading?: number;
  speed_kmh?: number;
}

export interface Incident {
  id: string;
  code: string;
  type: IncidentType;
  priority: Priority;
  location: LatLng;
  address?: string;
  caller_name?: string;
  caller_phone?: string;
  description?: string;
  status: IncidentStatus;
  reported_at: string;
  completed_at?: string;
}

export interface Dispatch {
  id: string;
  incident_id: string;
  ambulance_id: string;
  hospital_id?: string;
  stage: MissionStage;
  patient_note?: string;
  score?: DispatchScore;
  created_at: string;
  accepted_at?: string;
  on_scene_at?: string;
  transporting_at?: string;
  arrived_hospital_at?: string;
  completed_at?: string;
}

export interface DispatchScore {
  ambulance_score: number;
  hospital_score: number;
  eta_scene_min: number;
  eta_hospital_min: number;
}

export interface RankedOption {
  id: string;
  score: number;
  eta_min: number;
  reasons: string[];
}

export interface Notification {
  id: string;
  recipient_id?: string;
  recipient_role?: UserRole;
  kind: 'dispatch' | 'incoming' | 'status' | 'alert';
  title: string;
  body?: string;
  payload?: any;
  read: boolean;
  created_at: string;
}

export interface DispatchWeights {
  weight_travel: number;
  weight_traffic: number;
  weight_capacity: number;
  weight_specialty: number;
  weight_priority: number;
  auto_dispatch: boolean;
}

// UI helpers
export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string; text: string; ring: string; dot: string }> = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-400', ring: 'ring-red-500/40', dot: 'bg-red-500' },
  high: { label: 'HIGH', color: '#f97316', bg: 'bg-orange-500/15', text: 'text-orange-400', ring: 'ring-orange-500/40', dot: 'bg-orange-500' },
  medium: { label: 'MEDIUM', color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/40', dot: 'bg-amber-500' },
  low: { label: 'LOW', color: '#10b981', bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/40', dot: 'bg-emerald-500' },
};

export const STATUS_META: Record<AmbulanceStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: '#10b981' },
  dispatched: { label: 'Dispatched', color: '#f59e0b' },
  en_route: { label: 'En Route', color: '#f59e0b' },
  on_scene: { label: 'On Scene', color: '#f97316' },
  transporting: { label: 'Transporting', color: '#ef4444' },
  at_hospital: { label: 'At Hospital', color: '#8b5cf6' },
  offline: { label: 'Offline', color: '#64748b' },
  maintenance: { label: 'Maintenance', color: '#64748b' },
};

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  cardiac: 'Cardiac Arrest', trauma: 'Trauma', stroke: 'Stroke',
  obstetric: 'Obstetric', accident: 'RTA', respiratory: 'Respiratory', other: 'Other'
};
