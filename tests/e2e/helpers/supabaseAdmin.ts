/**
 * E2E Supabase Admin Helper
 *
 * Service-role Supabase client for E2E tests that need to assert on or clean up
 * server state directly (bypassing RLS) — e.g. proving "no duplicate row was
 * created" for the field-audit draft resume guarantee.
 *
 * Env is loaded via tests/setup/e2eEnv.ts (.env.test > .env) with the same
 * production guard as playwright.config.ts. Never import this into app code.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSafeE2ETarget } from '../../setup/e2eEnv';

const { url: SUPABASE_URL } = assertSafeE2ETarget('e2e/supabaseAdmin');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** True when the service-role env needed for DB assertions is present. */
export function hasAdminEnv(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

let cached: SupabaseClient | null = null;

/** Lazily-created service-role client. Throws if env is missing. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
      'E2E DB assertions require VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env / .env.local',
    );
  }
  if (!cached) {
    cached = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
