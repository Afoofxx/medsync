import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Cross, LogIn, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui';

export default function LoginPage() {
  const { signIn, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already authenticated, redirect to role home
  if (!loading && profile) {
    const home = profile.role === 'control' ? '/control'
      : profile.role === 'ambulance' ? '/ambulance'
      : profile.role === 'hospital' ? '/hospital' : '/';
    return <Navigate to={home} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setErr(error);
  }

  return (
    <div className="min-h-screen bg-surface-0 text-white flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Cross className="w-7 h-7 text-slate-950" strokeWidth={3} />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">MedSync.ng</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.25em] mt-0.5">Emergency Response · Lagos</div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950/80 border border-white/10 shadow-2xl p-8">
          <h1 className="text-lg font-semibold text-white">Sign in to your dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Authorized personnel only. All actions are logged.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-1 w-full bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full bg-slate-900 border border-white/5 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40" />
            </div>

            {err && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {err}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              <LogIn className="w-4 h-4" />
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 flex items-start gap-2 text-[11px] text-slate-500">
            <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Your role determines which dashboard you access. Control · Ambulance · Hospital.</span>
          </div>
        </div>

        <div className="mt-6 text-center text-[10px] text-slate-600 uppercase tracking-widest">
          v0.1 · Lagos State Emergency Operations
        </div>
      </div>
    </div>
  );
}
