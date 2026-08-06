import { supabase } from './supabaseClient';

// Flag to prevent logging re-entrancy / infinite loops
let isLoggerSubmitting = false;

export const logErrorToSupabase = async (
  error: any,
  extra?: { componentStack?: string; notes?: string }
) => {
  if (isLoggerSubmitting) return; // Prevent re-entrancy
  
  isLoggerSubmitting = true;
  try {
    const userRes = await supabase.auth.getUser();
    const userId = userRes?.data?.user?.id || null;
    
    let msg = 'Unknown Error';
    let stack = '';
    
    if (error instanceof Error) {
      msg = error.message;
      stack = error.stack || '';
    } else if (typeof error === 'object' && error !== null) {
      msg = error.message || JSON.stringify(error);
      stack = error.stack || '';
    } else {
      msg = String(error);
    }

    // Do not log connection/logger failures to avoid loops
    if (
      msg.includes('logs') || 
      msg.includes('CRITICAL: Failed to submit log to Supabase') ||
      msg.includes('Failed to fetch')
    ) {
      isLoggerSubmitting = false;
      return;
    }

    await supabase.from('logs').insert([{
      error_message: msg,
      error_stack: stack,
      component_stack: extra?.componentStack || '',
      url: window.location.href,
      user_id: userId,
      notes: extra?.notes || ''
    }]);
  } catch (err) {
    // Fail silently without calling console.error to avoid infinite loop recursion
  } finally {
    isLoggerSubmitting = false;
  }
};

if (typeof window !== 'undefined') {
  // Capture unhandled runtime exceptions
  window.addEventListener('error', (event) => {
    logErrorToSupabase(event.error || event.message, {
      notes: 'Global window.onerror event listener'
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logErrorToSupabase(event.reason, {
      notes: 'Global window.unhandledrejection event listener'
    });
  });
}

