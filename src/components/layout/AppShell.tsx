import { useEffect, useState } from 'react';
import { Bell, LogOut, Sun, Moon, Cross } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useNotifications } from '@/hooks/useNotifications';
import { cn, fmtAgo } from '@/lib/utils';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut, role } = useAuth();
  const { theme, toggle } = useTheme();
  const { notifications, unread, markAllRead } = useNotifications(role);
  const [now, setNow] = useState(Date.now());
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const roleLabel = role === 'control' ? 'Emergency Control'
    : role === 'ambulance' ? 'Ambulance Crew'
    : role === 'hospital' ? 'Hospital' : 'User';

  return (
    <div className="h-screen w-screen bg-surface-0 text-slate-200 overflow-hidden font-sans flex flex-col">
      <header className="h-14 border-b border-white/5 bg-slate-950/80 backdrop-blur px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Cross className="w-5 h-5 text-slate-950" strokeWidth={3} />
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-tight leading-none">MedSync</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-widest leading-none mt-0.5">{roleLabel} · Lagos</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tabular-nums">{new Date(now).toLocaleTimeString('en-GB')}</span>
            <span className="text-slate-600">·</span>
            <span>WAT</span>
          </div>

          <button onClick={toggle} className="rounded-lg bg-slate-900 hover:bg-slate-800 p-2" title="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4 text-slate-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          <div className="relative">
            <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) markAllRead(); }}
              className="relative rounded-lg bg-slate-900 hover:bg-slate-800 p-2">
              <Bell className="w-4 h-4 text-slate-300" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{unread}</span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-11 w-80 rounded-xl bg-slate-950 border border-white/10 shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 text-xs font-semibold text-white">Notifications</div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 && <div className="p-6 text-center text-slate-500 text-xs">No notifications</div>}
                  {notifications.slice(0, 15).map(n => (
                    <div key={n.id} className="px-4 py-3 border-b border-white/5 hover:bg-slate-900">
                      <div className="flex items-start gap-2">
                        <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5',
                          n.kind === 'alert' ? 'bg-red-500' :
                          n.kind === 'dispatch' ? 'bg-amber-500' :
                          n.kind === 'incoming' ? 'bg-cyan-500' : 'bg-emerald-500')} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-white">{n.title}</div>
                          {n.body && <div className="text-[11px] text-slate-400 mt-0.5">{n.body}</div>}
                          <div className="text-[10px] text-slate-600 mt-1">{fmtAgo(n.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
              {profile?.full_name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() ?? 'U'}
            </div>
            <button onClick={signOut} className="text-slate-500 hover:text-white p-1" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
