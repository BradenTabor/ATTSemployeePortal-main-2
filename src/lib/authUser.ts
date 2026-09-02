/**
 * Fast access to the signed-in user for the submission/upload path.
 *
 * `supabase.auth.getUser()` is a network round-trip to GoTrue on every call
 * (it re-validates the JWT server-side). Every photo upload and every form
 * submit was paying that latency before doing any real work — on LTE that is
 * 300–800 ms per call, and a DVIR made ~7 of them.
 *
 * `getSession()` reads the locally cached session (auto-refreshed by the SDK).
 * The JWT is still verified by Storage/PostgREST on the actual request, so
 * trusting the local session here loses no security — a stale token simply
 * fails the upload with 401 exactly as it would have failed `getUser()`.
 */
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

/**
 * Resolve the current user from the local session, falling back to a network
 * `getUser()` only when no session is cached (e.g. mid-hydration).
 */
export async function getAuthUserFast(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/** Like `getAuthUserFast` but throws a user-facing error when signed out. */
export async function requireAuthUser(message = "You must be signed in. Please sign in and try again."): Promise<User> {
  const user = await getAuthUserFast();
  if (!user) throw new Error(message);
  return user;
}
