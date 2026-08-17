import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './routes/router'
import './index.css'

import { useState, useEffect } from 'react'
import { LockScreen } from './components/LockScreen'
import { applyTheme, getSavedTheme } from './lib/theme'

applyTheme(getSavedTheme());

// Create TanStack Query client for data fetching queries
const queryClient = new QueryClient();

function AppWrapper() {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const hasPin = localStorage.getItem('app_pin');
    const isUnlocked = sessionStorage.getItem('app_unlocked');
    if (hasPin && !isUnlocked) {
      setLocked(true);
    }

    // Lock if page is hidden for more than 5 minutes
    let timeoutId: number;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        timeoutId = window.setTimeout(() => {
          if (localStorage.getItem('app_pin')) {
            sessionStorage.removeItem('app_unlocked');
            setLocked(true);
          }
        }, 5 * 60 * 1000); // 5 minutes
      } else {
        window.clearTimeout(timeoutId);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppWrapper />
    </QueryClientProvider>
  </StrictMode>,
)
