import React, { useState, useEffect } from 'react';
import { Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { 
  Home, Wallet, Target, Settings, 
  ChevronLeft, ChevronRight, LogOut, Sun, Moon, 
  Monitor, AlertCircle, Plus, TrendingUp
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { NotificationsBell } from '../components/NotificationsBell';
import { ToastContainer } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { toast } from '../lib/useToastStore';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AnimatePresence, motion } from 'framer-motion';
const logoImage = import.meta.env.BASE_URL + 'logo.png';

import type { Session } from '@supabase/supabase-js';

const navigationItems = [
  { label: 'Home', path: '/', icon: Home, keywords: 'summary status greeting dashboard' },
  { label: 'My Money', path: '/money', icon: Wallet, keywords: 'spent income checking cash stars coffee' },
  { label: 'Goals & Loans', path: '/goals', icon: Target, keywords: 'save bike bridal laptop target travel loan emi debt liability' },
  { label: 'Assets', path: '/investments', icon: TrendingUp, keywords: 'stocks market mutual funds gold fd property vehicle assets' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'theme currencies reset local storage' },
];

export const RootLayout: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (window.localStorage.getItem('theme') as any) || 'system';
  });

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const routerState = useRouterState();
  const navigate = useNavigate();

  // Auth Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Theme Sync
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      root.classList.remove('light', 'dark');
      if (t === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };
    applyTheme(theme);
    window.localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isSignUp) {
        if (!authFirstName.trim() || !authLastName.trim() || !authPhone.trim() || !authEmail.trim() || !authPassword.trim()) {
          throw new Error('All fields (First Name, Last Name, Mobile Number, Email Address, and Password) are mandatory.');
        }
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              first_name: authFirstName,
              last_name: authLastName,
              phone: authPhone
            }
          }
        });
        if (error) throw error;
        toast.success('Welcome! Your sandbox account is set up. Click Login.');
        setIsSignUp(false);
      } else {
        const isPhone = /^[+\d\s\-()]+$/.test(authEmail.trim()) && !authEmail.includes('@');
        const credentials = isPhone 
          ? { phone: authEmail.trim(), password: authPassword }
          : { email: authEmail.trim(), password: authPassword };

        const { data, error } = await supabase.auth.signInWithPassword(credentials as any);
        if (error) throw error;
        setSession(data.session);
        navigate({ to: '/' });
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!authEmail.trim()) {
      toast.error('Please enter your email address in the field above first.');
      return;
    }
    if (!authEmail.includes('@')) {
      toast.error('Please enter a valid email address to request a password reset.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      toast.success('Password reset email sent successfully! Check your inbox.');
    } catch (err: any) {
      toast.error(err.message || 'Error sending reset email');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Navigation items are extracted outside the component to avoid re-creation

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good morning';
    if (hrs < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getUserDisplayName = () => {
    const meta = session?.user?.user_metadata;
    if (meta && (meta.first_name || meta.last_name)) {
      return `${meta.first_name || ''} ${meta.last_name || ''}`.trim();
    }
    return session?.user?.email?.split('@')[0] || 'User';
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Auth gate
  if (!session) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center bg-background p-4 overflow-hidden select-none">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl relative z-10 glass">
          <div className="flex flex-col items-center justify-center gap-1.5 mb-6 text-center">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-white shrink-0 shadow-sm border border-border/50 flex items-center justify-center">
              <img src={logoImage} alt="WealthMap Logo" className="h-full w-full object-cover scale-[1.35]" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">WealthMap</h1>
            <p className="text-xs text-muted-foreground">
              A simple, friendly way to track your balance, spends, and savings.
            </p>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/25 p-3 flex gap-2 items-center text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {isSignUp && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">First Name</label>
                    <input
                      type="text"
                      required
                      value={authFirstName}
                      onChange={(e) => setAuthFirstName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="John"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      required
                      value={authLastName}
                      onChange={(e) => setAuthLastName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-muted-foreground">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    value={authPhone}
                    onChange={(e) => setAuthPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="e.g. +1 555-555-5555"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-muted-foreground">
                {isSignUp ? 'Email Address' : 'Email Address or Mobile Number'}
              </label>
              <input
                type={isSignUp ? 'email' : 'text'}
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 animate-none"
                placeholder={isSignUp ? 'name@example.com' : 'email or phone number'}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center select-none">
                <label className="text-[11px] font-bold text-muted-foreground">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] text-primary hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <Button type="submit" loading={authLoading} className="w-full mt-2 py-2 cursor-pointer">
              {isSignUp ? 'Create Account' : 'Log In'}
            </Button>
          </form>

          <div className="flex justify-between items-center mt-5 text-[11px] text-muted-foreground">
            <span>
              {isSignUp ? 'Already registered?' : 'New here?'}
            </span>
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              {isSignUp ? 'Log In Instead' : 'Create Free Account'}
            </button>
          </div>


        </div>
      </div>
    );
  }

  // Logged-in App shell
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      
      {/* DESKTOP SIDEBAR */}
      <div className="hidden md:flex p-4 pr-0">
        <aside 
          className={`
            flex flex-col h-full bg-card clay rounded-[1.5rem] transition-all duration-300 relative z-20 select-none overflow-hidden
            ${isSidebarCollapsed ? 'w-[70px]' : 'w-[228px]'}
          `}
        >
        {/* Header Logo */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 overflow-hidden h-[44px] shrink-0">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-white shrink-0 shadow-sm border border-border/50 flex items-center justify-center">
            <img src={logoImage} alt="WealthMap Logo" className="h-full w-full object-cover scale-[1.35]" />
          </div>
          {!isSidebarCollapsed && (
            <span className="font-bold text-base tracking-tight text-foreground">WealthMap</span>
          )}
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 px-2 py-6 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = routerState.location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 h-[44px] rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer
                  ${isActive 
                    ? 'bg-primary/5 text-primary' 
                    : 'text-muted-foreground hover:bg-[#F8F8F8] dark:hover:bg-white/5 hover:text-foreground'
                  }
                `}
              >
                <Icon className={`h-[20px] w-[20px] shrink-0 ${!isActive ? 'opacity-70' : 'opacity-100'}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer theme/logout */}
        <div className="px-2 pb-4 pt-4 flex flex-col gap-1">
          {!isSidebarCollapsed ? (
            <div className="flex bg-muted/30 p-1 rounded-lg">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`
                    flex-1 py-1 text-[10px] font-bold rounded capitalize flex justify-center items-center gap-1 cursor-pointer transition-all duration-150
                    ${theme === t ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100'}
                  `}
                >
                  {t === 'light' && <Sun className="h-3 w-3" />}
                  {t === 'dark' && <Moon className="h-3 w-3" />}
                  {t === 'system' && <Monitor className="h-3 w-3" />}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          ) : (
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
              className="flex justify-center items-center w-full h-[44px] hover:bg-[#F8F8F8] dark:hover:bg-white/5 rounded-lg text-muted-foreground opacity-70 hover:opacity-100 cursor-pointer transition-all duration-150"
            >
              {theme === 'light' && <Sun className="h-[20px] w-[20px]" />}
              {theme === 'dark' && <Moon className="h-[20px] w-[20px]" />}
              {theme === 'system' && <Monitor className="h-[20px] w-[20px]" />}
            </button>
          )}

          <button
            onClick={handleSignOut}
            className={`
              flex items-center gap-3 px-4 h-[44px] rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-all duration-150 cursor-pointer
              ${isSidebarCollapsed ? 'justify-center px-0' : ''}
            `}
          >
            <LogOut className="h-[20px] w-[20px] shrink-0 opacity-80" />
            {!isSidebarCollapsed && <span>Log Out</span>}
          </button>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute bottom-[80px] right-[-12px] h-6 w-6 rounded-full border border-border bg-card shadow-xs flex items-center justify-center hover:bg-muted text-muted-foreground z-30 cursor-pointer"
        >
          {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>
      </div>

      <div className="md:hidden fixed bottom-4 left-4 right-4 h-[64px] bg-card clay rounded-[2rem] flex items-center justify-between px-2 z-40 select-none w-[calc(100%-32px)]">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = routerState.location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center justify-center gap-1 flex-1 h-[44px] cursor-pointer
                ${isActive ? 'text-primary' : 'text-muted-foreground'}
              `}
            >
              <Icon className="h-[20px] w-[20px]" />
              <span className="text-[10px] font-bold">{item.label.split(' ')[0] === 'My' ? item.label.split(' ')[1] : item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </div>

      <button
        onClick={() => {
          navigate({ to: '/money' });
          setTimeout(() => {
            const input = document.getElementById('quick-expense-input');
            if (input) input.focus();
          }, 200);
        }}
        className="md:hidden fixed bottom-[90px] right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground clay-btn flex items-center justify-center z-50 cursor-pointer"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* MAIN CONTENT SECTION */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pb-[80px] md:pb-0">
        
        {/* HEADER BAR */}
        <header className="hidden md:flex bg-background px-4 sm:px-6 items-center justify-between shrink-0 z-10 select-none border-b border-border/40 h-[64px]">
          
          {/* Greeting message */}
          <div className="flex flex-col justify-center">
            <span className="text-[16px] font-semibold text-foreground whitespace-nowrap leading-tight">
              {getGreeting()}, {getUserDisplayName()}!
            </span>
            <span className="text-[13px] text-muted-foreground whitespace-nowrap leading-tight">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            <NotificationsBell />
          </div>
        </header>

        {/* SCROLLABLE MAIN OUTLET */}
        <main className={`flex-1 overflow-y-auto bg-background/50 px-2.5 sm:px-6 py-4 sm:py-6 ${routerState.location.pathname === '/' ? 'pt-2 sm:pt-6' : ''}`}>
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={routerState.location.pathname}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </div>

      <ConfirmDialog />
      <ToastContainer />
    </div>
  );
};
