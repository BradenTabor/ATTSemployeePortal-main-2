import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('Supabase environment variables are missing!');
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// SEC-009: Only log Supabase URL in development, never in production
if (import.meta.env.DEV) {
  logger.info('Supabase client initialized successfully', {
    url: supabaseUrl.substring(0, 30) + '...',
  });
} else {
  logger.info('Supabase client initialized successfully');
}
