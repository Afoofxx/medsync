import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchPlaces, type NominatimResult } from '@/lib/maps';

export interface PlaceResult {
  address: string;
  location: { lat: number; lng: number };
  place_id: number;
}

interface Props {
  value?: PlaceResult | null;
  onChange: (place: PlaceResult | null) => void;
  placeholder?: string;
  className?: string;
}

export function PlacesAutocomplete({ value, onChange, placeholder, className }: Props) {
  const [input, setInput] = useState(value?.address ?? '');
  const [predictions, setPredictions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value?.address && value.address !== input) setInput(value.address);
  }, [value?.address]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPredictions = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    if (!q.trim() || q.trim().length < 3) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const results = await searchPlaces(q, ctrl.signal);
    if (!ctrl.signal.aborted) {
      setPredictions(results);
      setHighlighted(0);
      setOpen(results.length > 0);
      setLoading(false);
    }
  }, []);

  // Debounced fetch — Nominatim asks for ≤1 req/sec, so 500ms is safe
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchPredictions(input), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, fetchPredictions]);

  function select(p: NominatimResult) {
    const short = p.display_name.split(',').slice(0, 3).join(',').trim();
    setInput(short);
    setOpen(false);
    onChange({
      address: short,
      location: { lat: parseFloat(p.lat), lng: parseFloat(p.lon) },
      place_id: p.place_id,
    });
  }

  function clear() {
    setInput('');
    setPredictions([]);
    setOpen(false);
    onChange(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || predictions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(predictions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const confirmed = !!value && input === value.address;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          value={input}
          onChange={e => { setInput(e.target.value); if (value) onChange(null); }}
          onFocus={() => { if (predictions.length > 0) setOpen(true); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? 'Search a Lagos address…'}
          className={cn(
            'w-full bg-slate-900 border rounded-lg pl-9 pr-9 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition',
            confirmed ? 'border-emerald-500/40' : 'border-white/5',
            className
          )}
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 animate-spin" />
        ) : confirmed ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <button type="button" onClick={clear} className="text-slate-500 hover:text-white p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : input ? (
          <button type="button" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {confirmed && value && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-400">
          <MapPin className="w-3 h-3" />
          <span className="tabular-nums">{value.location.lat.toFixed(5)}, {value.location.lng.toFixed(5)}</span>
        </div>
      )}

      {open && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto">
          {predictions.map((p, i) => {
            const parts = p.display_name.split(',').map(s => s.trim());
            const main = parts[0];
            const secondary = parts.slice(1, 4).join(', ');
            return (
              <button
                key={p.place_id}
                type="button"
                onClick={() => select(p)}
                onMouseEnter={() => setHighlighted(i)}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition border-b border-white/5 last:border-b-0',
                  i === highlighted ? 'bg-slate-800' : 'hover:bg-slate-900'
                )}
              >
                <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{main}</div>
                  {secondary && <div className="text-[11px] text-slate-500 truncate mt-0.5">{secondary}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
