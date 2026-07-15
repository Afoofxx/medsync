import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Notification, UserRole } from '@/types';

export function useNotifications(role: UserRole | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!role) return;

    supabase.from('notifications')
      .select('*')
      .or(`recipient_role.eq.${role},recipient_role.is.null`)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) {
          setNotifications(data);
          setUnread(data.filter(n => !n.read).length);
        }
      });

    const chan = supabase
      .channel(`rt-notif-${role}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        if (n.recipient_role === role || !n.recipient_role) {
          setNotifications(prev => [n, ...prev].slice(0, 30));
          setUnread(u => u + 1);
          // Browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(n.title, { body: n.body, icon: '/favicon.svg' });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(chan); };
  }, [role]);

  async function markAllRead() {
    if (!role) return;
    await supabase.from('notifications').update({ read: true }).eq('recipient_role', role).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  }

  return { notifications, unread, markAllRead };
}
