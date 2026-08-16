import React, { useEffect, useState } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { User } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/** Mobile-only profile avatar that opens Settings (top-right pattern). */
export function MobileProfileButton({ className = '' }: { className?: string }) {
  const [initials, setInitials] = useState('');
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = pathname === '/settings' || pathname.startsWith('/settings/');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata || {};
      const first = (meta.first_name as string | undefined)?.[0] || '';
      const last = (meta.last_name as string | undefined)?.[0] || '';
      const fromName = `${first}${last}`.toUpperCase();
      if (fromName) {
        setInitials(fromName);
        return;
      }
      setInitials((user.email?.[0] || 'U').toUpperCase());
    });
  }, []);

  return (
    <Link
      to="/settings"
      aria-label="Open settings"
      className={`md:hidden flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-[11px] font-bold shrink-0 cursor-pointer active:scale-95 shadow-sm border border-white/15 ${
        isActive ? 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background' : ''
      } ${className}`}
    >
      {initials ? initials : <User className="h-4 w-4" />}
    </Link>
  );
}
