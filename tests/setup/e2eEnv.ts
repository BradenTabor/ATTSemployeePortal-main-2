/**
 * E2E environment loader + production guard.
 *
 * Every script that can WRITE to Supabase on behalf of the test suite (seeding
 * users, the Playwright web server, the service-role assertion helper) goes
 * through `assertSafeE2ETarget()`. It refuses to run when the resolved Supabase
 * URL is the production project, unless the operator sets an explicit,
 * deliberately verbose override.
 *
 * Precedence (first file wins for a given key — dotenv never overrides keys that
 * are already set):
 *   process env  >  .env.test.local  >  .env.test  >  .env.local  >  .env
 *
 * Vite mirrors this when started with `--mode test`, so the app under test and
 * the test scripts resolve the same project. `.env.test` is gitignored; copy
 * `.env.test.example` to get started (defaults to `supabase start`).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

/** Supabase project refs that must never receive test data. */
export const PROD_PROJECT_REFS: ReadonlySet<string> = new Set(['emqqxfzahmwnehxcpxzp']);

/** Exact value required to bypass the guard. Long on purpose. */
export const E2E_PROD_OVERRIDE = 'I_UNDERSTAND_THIS_WRITES_TEST_DATA_TO_PROD';

/** Dedicated dev-server port so a prod-pointed `npm run dev` is never reused. */
export const E2E_PORT = 5183;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

const ENV_FILES = ['.env.test.local', '.env.test', '.env.local', '.env'] as const;

let loaded = false;

export function loadE2EEnv(): void {
  if (loaded) return;
  loaded = true;
  for (const file of ENV_FILES) {
    const path = join(process.cwd(), file);
    if (existsSync(path)) config({ path, quiet: true });
  }
}

export function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = /^https?:\/\/([a-z0-9-]+)\.supabase\.(?:co|in|net|red)(?:[/:]|$)/i.exec(url.trim());
  return m?.[1]?.toLowerCase() ?? null;
}

export function isProdSupabaseUrl(url: string | undefined): boolean {
  const ref = projectRefFromUrl(url);
  return ref !== null && PROD_PROJECT_REFS.has(ref);
}

export interface E2ETarget {
  url: string;
  ref: string | null;
  /** True when the guard was bypassed via E2E_ALLOW_PROD. */
  prodOverride: boolean;
}

/**
 * Resolve the Supabase URL the suite will hit and throw if it is production.
 * `context` names the caller in the error (e.g. "playwright", "seedTestUsers").
 */
export function assertSafeE2ETarget(context: string): E2ETarget {
  loadE2EEnv();
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const ref = projectRefFromUrl(url);

  if (!url) {
    throw new Error(
      `[${context}] No Supabase URL. Set VITE_SUPABASE_URL in .env.test (see .env.test.example).`,
    );
  }

  const prodOverride = process.env.E2E_ALLOW_PROD === E2E_PROD_OVERRIDE;
  if (isProdSupabaseUrl(url) && !prodOverride) {
    throw new Error(
      [
        `[${context}] Refusing to run against PRODUCTION Supabase (${ref}).`,
        '',
        'E2E tests and seed scripts create @atts.test accounts and fake submissions.',
        'Point them at a local or dedicated test project instead:',
        '  1. cp .env.test.example .env.test',
        '  2. supabase start   (or fill in a separate test project URL/keys)',
        '  3. npm run test:setup && npm run test:e2e',
        '',
        `To knowingly override (and clean up afterwards with npm run test:cleanup-db):`,
        `  E2E_ALLOW_PROD=${E2E_PROD_OVERRIDE} <command>`,
      ].join('\n'),
    );
  }

  if (prodOverride && isProdSupabaseUrl(url)) {
    console.warn(
      `\n⚠️  [${context}] E2E_ALLOW_PROD set — writing test data to PRODUCTION (${ref}). ` +
        'Run `npm run test:cleanup-db` when finished.\n',
    );
  }

  return { url, ref, prodOverride };
}
