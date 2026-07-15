import React from 'react';
import { X, Minus, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------
export function Button({
  children, className, variant = 'default', size = 'md', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants: Record<string, string> = {
    default: 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/5',
    primary: 'bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-400 text-white shadow-lg shadow-cyan-950/50',
    danger: 'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 text-white shadow-lg shadow-red-950/50',
    success: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-950/50',
    ghost: 'text-slate-400 hover:text-white hover:bg-slate-900',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base font-semibold',
  };
  return (
    <button className={cn('rounded-lg font-semibold inline-flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed', variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

// -----------------------------------------------------------------
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide', className)}>{children}</span>;
}

// -----------------------------------------------------------------
export function StatCard({ icon: Icon, label, value, delta, tone = 'default' }: {
  icon: any; label: string; value: string | number; delta?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass = tone === 'good' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-red-400' : 'text-slate-300';
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        <Icon className={cn('w-4 h-4', toneClass)} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white tabular-nums">{value}</span>
        {delta && <span className={cn('text-xs', toneClass)}>{delta}</span>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
export function Counter({ icon: Icon, label, value, onDelta, tone = 'cyan', small = false }: {
  icon: any; label: string; value: number; onDelta: (d: number) => void;
  tone?: 'cyan' | 'amber' | 'rose' | 'violet' | 'emerald';
  small?: boolean;
}) {
  const toneMap: Record<string, string> = {
    cyan: 'text-cyan-400', amber: 'text-amber-400', rose: 'text-rose-400', violet: 'text-violet-400', emerald: 'text-emerald-400'
  };
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</span>
        <Icon className={cn('w-3.5 h-3.5', toneMap[tone])} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button onClick={() => onDelta(-1)}
          className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center">
          <Minus className="w-4 h-4" />
        </button>
        <span className={cn(small ? 'text-2xl' : 'text-3xl', 'font-bold text-white tabular-nums')}>{value}</span>
        <button onClick={() => onDelta(1)}
          className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
export function Modal({ open, onClose, children, maxWidth = 'max-w-2xl' }: {
  open: boolean; onClose: () => void; children: React.ReactNode; maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4" onClick={onClose}>
      <div className={cn('w-full bg-slate-950 rounded-2xl border border-white/10 shadow-2xl max-h-[92vh] overflow-hidden flex flex-col', maxWidth)}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, subtitle, onClose, icon }: { title: string; subtitle?: string; onClose: () => void; icon?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 className="text-white font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
    </div>
  );
}

// -----------------------------------------------------------------
export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" />
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}
