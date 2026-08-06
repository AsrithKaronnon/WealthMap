import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard: throw hard error if credentials are missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Please set these environment variables in your .env file to connect to Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type SupabaseClientType = typeof supabase;

