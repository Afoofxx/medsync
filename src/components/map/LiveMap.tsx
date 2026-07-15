import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TILE_URL_DARK, TILE_ATTRIBUTION, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/maps';
import type { Ambulance, Hospital, Incident } from '@/types';
import { STATUS_META, PRIORITY_META } from '@/types';

interface Props {
  ambulances: Ambulance[];
  hospitals: Hospital[];
  incidents: Incident[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onAmbulanceClick?: (id: string) => void;
  onIncidentClick?: (id: string) => void;
  selectedAmbulanceId?: string;
  route?: [number, number][];
}

// --- Icon factories ------------------------------------------------
function ambulanceIcon(status: keyof typeof STATUS_META, callSign: string, selected: boolean) {
  const color = STATUS_META[status].color;
  const pulsing = status !== 'available' && status !== 'offline' && status !== 'maintenance';
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="position:relative;transform:translate(-50%,-50%);left:50%;top:50%">
        ${selected ? `<div style="position:absolute;left:-6px;top:-6px;width:36px;height:36px;border-radius:50%;border:2px solid #22d3ee;animation:pulse 1.5s infinite"></div>` : ''}
        ${pulsing ? `<div style="position:absolute;left:-8px;top:-8px;width:40px;height:40px;border-radius:50%;background:${color};opacity:.25;animation:pulse 1.4s infinite"></div>` : ''}
        <div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #0b1220;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;font-family:ui-sans-serif">+</div>
        <div style="position:absolute;left:50%;transform:translateX(-50%);margin-top:2px;font-size:9px;font-weight:800;color:#fff;background:rgba(2,6,20,.8);padding:1px 4px;border-radius:3px;white-space:nowrap">${callSign}</div>
      </div>`,
  });
}

function hospitalIcon(shortName: string, edStatus: string) {
  const bg = edStatus === 'diversion' ? '#7c2d12' : edStatus === 'busy' ? '#78350f' : '#065f46';
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="position:relative;transform:translate(-50%,-50%);left:50%;top:50%">
        <div style="width:24px;height:24px;border-radius:4px;background:${bg};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:16px;font-family:ui-sans-serif">+</div>
        <div style="position:absolute;left:50%;transform:translateX(-50%);margin-top:2px;font-size:9px;font-weight:800;color:#fff;background:rgba(2,6,20,.8);padding:1px 4px;border-radius:3px;white-space:nowrap">${shortName}</div>
      </div>`,
  });
}

function incidentIcon(priority: keyof typeof PRIORITY_META) {
  const color = PRIORITY_META[priority].color;
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `
      <div style="position:relative;transform:translate(-50%,-50%);left:50%;top:50%">
        <div style="position:absolute;left:-8px;top:-8px;width:36px;height:36px;border-radius:50%;background:${color};opacity:.3;animation:pulse 1.6s infinite"></div>
        <div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 12px ${color}88;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px;font-family:ui-sans-serif">!</div>
      </div>`,
  });
}

// --- Recenter helper -----------------------------------------------
function Recenter({ center, zoom }: { center?: { lat: number; lng: number }; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }, [center?.lat, center?.lng, zoom]);
  return null;
}

// --- Component -----------------------------------------------------
export function LiveMap({
  ambulances, hospitals, incidents, center, zoom,
  onAmbulanceClick, onIncidentClick, selectedAmbulanceId, route,
}: Props) {
  const activeIncidents = useMemo(
    () => incidents.filter(i => i.status !== 'completed' && i.status !== 'cancelled'),
    [incidents]
  );

  return (
    <MapContainer
      center={[center?.lat ?? DEFAULT_CENTER.lat, center?.lng ?? DEFAULT_CENTER.lng]}
      zoom={zoom ?? DEFAULT_ZOOM}
      className="w-full h-full"
      style={{ background: '#050a14' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={TILE_URL_DARK} attribution={TILE_ATTRIBUTION} />
      <Recenter center={center} zoom={zoom} />

      {route && route.length > 1 && (
        <Polyline positions={route} pathOptions={{
          color: '#22d3ee', weight: 4, opacity: 0.85, dashArray: '8,4',
        }} />
      )}

      {hospitals.map(h => (
        <Marker
          key={h.id}
          position={[h.location.lat, h.location.lng]}
          icon={hospitalIcon(h.short_name, h.ed_status)}
        />
      ))}

      {activeIncidents.map(i => (
        <Marker
          key={i.id}
          position={[i.location.lat, i.location.lng]}
          icon={incidentIcon(i.priority)}
          eventHandlers={onIncidentClick ? { click: () => onIncidentClick(i.id) } : undefined}
        />
      ))}

      {ambulances.filter(a => a.location).map(a => (
        <Marker
          key={a.id}
          position={[a.location!.lat, a.location!.lng]}
          icon={ambulanceIcon(a.status, a.call_sign, a.id === selectedAmbulanceId)}
          eventHandlers={onAmbulanceClick ? { click: () => onAmbulanceClick(a.id) } : undefined}
        />
      ))}
    </MapContainer>
  );
}
