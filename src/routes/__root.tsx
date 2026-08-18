import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { 
  Home, Wallet, Target, Settings, FolderKanban, 
  ChevronLeft, ChevronRight, LogOut, Sun, Moon, 
  Monitor, AlertCircle, TrendingUp, WifiOff, Wifi, X, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { NotificationsBell } from '../components/NotificationsBell';
import { ToastContainer } from '../components/ui/Toast';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { toast } from '../lib/useToastStore';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { SprayFlow } from '../components/ui/SprayFlow';
import { pageTransition, pageVariants } from '../lib/motion';
import { haptic } from '../lib/haptics';
import { applyTheme, getSavedTheme, type ThemePreference } from '../lib/theme';
const logoImage = import.meta.env.BASE_URL + 'logo.png';

import type { Session } from '@supabase/supabase-js';

const navigationItems = [
  { label: 'Home', path: '/', icon: Home, keywords: 'summary status greeting dashboard' },
  { label: 'My Money', path: '/money', icon: Wallet, keywords: 'spent income checking cash stars coffee' },
  { label: 'Goals & Loans', path: '/goals', icon: Target, keywords: 'save bike bridal laptop target travel loan emi debt liability' },
  { label: 'Assets', path: '/investments', icon: TrendingUp, keywords: 'stocks market mutual funds gold fd property vehicle assets' },
  { label: 'Projects', path: '/projects', icon: FolderKanban, keywords: 'house wedding trip farm event build renovation project' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'theme currencies reset local storage' },
];

export const RootLayout: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => getSavedTheme());

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [connectionBanner, setConnectionBanner] = useState<'offline' | 'online' | null>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : null
  );
  const [authKeyboardInset, setAuthKeyboardInset] = useState(0);

  const routerState = useRouterState();
  const navigate = useNavigate();
  const mainScrollRef = useRef<HTMLElement>(null);

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

  // Offline / online banner
  useEffect(() => {
    const onOffline = () => setConnectionBanner('offline');
    const onOnline = () => setConnectionBanner('online');
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    if (!navigator.onLine) setConnectionBanner('offline');
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (session) {
      setAuthKeyboardInset(0);
      return;
    }
    const update = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setAuthKeyboardInset(0);
        return;
      }
      setAuthKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [session]);

  // Theme Sync
  useEffect(() => {
    window.localStorage.setItem('theme', theme);
    applyTheme(theme);

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
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`
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

  const connectionBannerEl = connectionBanner ? (
    <div className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] text-xs font-semibold ${
      connectionBanner === 'offline'
        ? 'bg-amber-500 text-amber-950'
        : 'bg-emerald-500 text-emerald-950'
    }`}>
      {connectionBanner === 'offline' ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : <Wifi className="h-3.5 w-3.5 shrink-0" />}
      <span className="flex-1 text-center">
        {connectionBanner === 'offline'
          ? 'You are offline — data may not be current'
          : 'Back online'}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setConnectionBanner(null)}
        className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

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
      <div
        className="relative flex h-screen w-screen items-center justify-center bg-background p-4 overflow-y-auto overflow-x-hidden select-none pb-[env(safe-area-inset-bottom,0px)]"
        style={authKeyboardInset ? { paddingBottom: authKeyboardInset } : undefined}
      >
        {connectionBannerEl}
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm rounded-[1.5rem] bg-card p-6 sm:p-8 relative z-10 clay">
          <div className="flex flex-col items-center justify-center gap-1.5 mb-6 text-center">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-white shrink-0 clay-btn flex items-center justify-center">
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
                      autoComplete="given-name"
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
                      autoComplete="family-name"
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
                    autoComplete="tel"
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
                autoComplete={isSignUp ? 'email' : 'username'}
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
              <div className="relative">
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-11 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="button"
                  aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowAuthPassword(!showAuthPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground cursor-pointer"
                >
                  {showAuthPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      {connectionBannerEl}
      
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
            const isActive =
              item.path === '/projects'
                ? routerState.location.pathname === '/projects' || routerState.location.pathname.startsWith('/projects/')
                : routerState.location.pathname === item.path;
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
            <div className="flex clay-input-wrapper p-1 rounded-lg">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`
                    flex-1 py-1 text-[10px] font-bold rounded capitalize flex justify-center items-center gap-1 cursor-pointer transition-all duration-150
                    ${theme === t ? 'bg-card text-foreground clay-btn' : 'text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100'}
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
          className="absolute bottom-[80px] right-[-12px] h-6 w-6 rounded-full clay-btn bg-card flex items-center justify-center hover:bg-muted text-muted-foreground z-30 cursor-pointer"
        >
          {isSidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>
      </div>

      <nav className="md:hidden mobile-bottom-nav clay fixed bottom-0 left-0 right-0 flex items-stretch px-1 pt-1 pb-[max(6px,env(safe-area-inset-bottom,0px))] z-40 select-none">
        <LayoutGroup>
        {navigationItems.filter((item) => item.path !== '/settings').map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/projects'
              ? routerState.location.pathname === '/projects' || routerState.location.pathname.startsWith('/projects/')
              : routerState.location.pathname === item.path;
          const shortLabel = item.path === '/money' ? 'Money' : item.path === '/goals' ? 'Goals' : item.label;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (!isActive) haptic('selection'); }}
              className={`
                relative flex flex-col items-center justify-center gap-0.5 flex-1 h-12 cursor-pointer active:scale-95
                ${isActive ? 'text-primary' : 'text-foreground/45'}
              `}
            >
              <span className="relative flex items-center justify-center h-7 w-7">
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-primary/12 clay-btn !rounded-full"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  />
                )}
                <motion.span
                  animate={{ scale: isActive ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  className="relative z-10 flex"
                >
                  <Icon className="h-[20px] w-[20px]" />
                </motion.span>
              </span>
              <span className="text-[10px] font-semibold leading-none">{shortLabel}</span>
            </Link>
          );
        })}
        </LayoutGroup>
      </nav>

      {/* MAIN CONTENT SECTION */}
      <div className="flex-1 flex flex-col h-full overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        
        {/* HEADER BAR */}
        <header className="hidden md:flex relative overflow-hidden bg-background px-4 sm:px-6 items-center justify-between shrink-0 z-10 select-none border-b border-border/40 h-[64px]">
          <SprayFlow />
          <div className="relative z-10 flex flex-col justify-center">
            <span className="text-[16px] font-semibold text-foreground whitespace-nowrap leading-tight">
              {getGreeting()}, {getUserDisplayName()}!
            </span>
            <span className="text-[13px] text-muted-foreground whitespace-nowrap leading-tight">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <NotificationsBell />
          </div>
        </header>

        {/* SCROLLABLE MAIN OUTLET */}
        <main
          ref={mainScrollRef}
          className={`flex-1 overflow-y-auto overscroll-contain bg-background px-3 md:px-6 ${
          routerState.location.pathname === '/'
            ? 'pt-3 pb-4 md:py-6'
            : 'pt-0 pb-4 md:py-6'
        }`}>
          <PullToRefresh scrollRef={mainScrollRef}>
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={routerState.location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="enter"
                exit="exit"
                transition={pageTransition}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
          </PullToRefresh>
        </main>
      </div>

      <ConfirmDialog />
      <ToastContainer />
    </div>
  );
};
