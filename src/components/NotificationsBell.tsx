import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from '@tanstack/react-router';

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (data) {
      setNotifications(data);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Use a unique channel name to prevent StrictMode clashes
    const channel = supabase.channel(`notifications_changes_${Math.random().toString(36).slice(2)}`)
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
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    setIsOpen(false);
    if (notification.action_url) {
      navigate({ to: notification.action_url });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative z-50" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-8 w-8 md:h-10 md:w-10 flex items-center justify-center rounded-xl bg-card md:bg-background text-foreground transition-all cursor-pointer shrink-0 clay-btn"
      >
        <Bell className="h-[16px] w-[16px] md:h-[18px] md:w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-[4px] right-[4px] md:top-[8px] md:right-[8px] h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card md:border-background flex items-center justify-center">
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden flex flex-col clay premium-glow-card">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <h3 className="font-semibold text-[14px]">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[12px] text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[350px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                <Bell className="h-8 w-8 opacity-20" />
                <p>You're all caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors relative ${!notif.is_read ? 'bg-brand-500/5' : ''}`}
                  >
                    {!notif.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-500"></div>
                    )}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 pr-4">
                        <p className={`text-[13px] ${!notif.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>
                          {notif.title}
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5 uppercase tracking-wider">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {notif.action_url && (
                        <div className="shrink-0 mt-1">
                          <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
