import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('[MedSync] Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase: SupabaseClient = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

/** Write an audit event. Best-effort; fails silently. */
export async function logActivity(action: string, resource_type?: string, resource_id?: string, metadata?: any) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    await supabase.from('activity_logs').insert({
      actor_id: user.id,
      actor_role: profile?.role,
      action, resource_type, resource_id, metadata,
      user_agent: navigator.userAgent,
    });
  } catch { /* silent */ }
}
