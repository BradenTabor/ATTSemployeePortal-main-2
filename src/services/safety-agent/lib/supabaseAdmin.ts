/**
 * Supabase Admin Client for Safety + Compliance Agent
 * 
 * This client uses the SERVICE_ROLE_KEY for server-to-server operations.
 * It bypasses RLS and should ONLY be used in:
 * - Supabase Edge Functions
 * - Server-side scripts
 * - CLI tools
 * 
 * NEVER expose this client to the frontend!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Declare globals for cross-runtime compatibility
declare const Deno: { env: { get(key: string): string | undefined } } | undefined;
declare const process: { env?: Record<string, string | undefined> } | undefined;

// Detect runtime environment
const isDeno = typeof Deno !== 'undefined';

// Get environment variables based on runtime
function getEnvVar(name: string): string | undefined {
  if (isDeno) {
    return Deno?.env.get(name);
  }
  // Node.js / Vite environment
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  // Vite import.meta.env (will be undefined in Deno)
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env) {
    return (import.meta as unknown as { env: Record<string, string> }).env[name];
  }
  return undefined;
}

let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * Get or create the Supabase admin client.
 * 
 * This function lazily creates the client to allow for environment
 * variables to be set before first use (useful in Edge Functions).
 * 
 * @throws Error if required environment variables are missing
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  // Re-check env vars (they may have been set after module load)
  const url = getEnvVar('SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) {
    throw new Error(
      'Missing SUPABASE_URL environment variable. ' +
      'Set SUPABASE_URL or VITE_SUPABASE_URL.'
    );
  }

  if (!serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'This key is required for server-to-server operations.'
    );
  }

  supabaseAdminInstance = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}

/**
 * Create a fresh Supabase admin client with explicit credentials.
 * 
 * Use this when you need to pass credentials explicitly (e.g., in tests).
 */
export function createSupabaseAdmin(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Export default instance getter
export default getSupabaseAdmin;

