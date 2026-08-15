import { useState, useEffect } from 'react';
import { Bell, Check, ArrowRight, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from '@tanstack/react-router';
import { Dialog } from './ui/Dialog';

export function NotificationsBell({ className = '' }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setNotifications(data);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`notifications_changes_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    setIsOpen(false);
    if (notification.action_url) {
      navigate({ to: notification.action_url });
    }
  };

  const relTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className={`relative h-11 w-11 md:h-10 md:w-10 flex items-center justify-center rounded-xl bg-card md:bg-background text-foreground transition-all cursor-pointer shrink-0 clay-btn ${className}`}
      >
        <Bell className="h-[16px] w-[16px] md:h-[18px] md:w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-[4px] right-[4px] md:top-[8px] md:right-[8px] h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card md:border-background" />
        )}
      </button>

      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title="Notifications" size="md">
        <div className="flex flex-col gap-2">
          {unreadCount > 0 && (
            <div className="flex justify-end -mt-1 mb-1">
              <button
                type="button"
                onClick={markAllAsRead}
                className="min-h-[44px] md:min-h-0 px-2 text-xs font-semibold text-primary flex items-center gap-1 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>
          )}
          <div className="flex flex-col gap-1 -mx-1 max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">You're all caught up.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left rounded-xl px-3 py-3 min-h-[44px] transition-colors cursor-pointer ${
                    !notif.is_read ? 'bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        !notif.is_read ? 'bg-primary' : 'bg-transparent'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${
                            !notif.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground'
                          }`}
                        >
                          {notif.title}
                        </p>
                        {notif.action_url && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                        )}
                      </div>
                      {notif.message && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{notif.message}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/70 mt-1.5">
                        {relTime(notif.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
