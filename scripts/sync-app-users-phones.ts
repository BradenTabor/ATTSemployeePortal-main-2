/**
 * Sync phone numbers into app_users from a fixed name/phone list.
 *
 * Matches on full_name (normalized: trim, strip trailing comma, case-insensitive).
 * If no exact full-name match, tries first-name match (e.g. DB "Tracer" matches
 * input "Tracer Burnes"). Updates only when exactly one row matches; otherwise
 * the name is reported in "could not confidently update".
 *
 * Usage:
 *   npx tsx scripts/sync-app-users-phones.ts           # run updates
 *   npx tsx scripts/sync-app-users-phones.ts --dry-run # preview only, no writes
 *
 * Requires: VITE_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(process.cwd(), '.env') });
config({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Input list: loaded from .tmp/employee-phones.csv (PII stays out of git) ─

const CSV_PATH = process.argv.find((a) => a.startsWith('--csv='))?.slice(6)
  ?? join(process.cwd(), '.tmp', 'employee-phones.csv');

function loadInputList(csvPath: string): { full_name: string; phone_number: string }[] {
  let raw: string;
  try {
    raw = readFileSync(csvPath, 'utf-8');
  } catch {
    console.error(`Cannot read CSV at ${csvPath}`);
    console.error('Place employee data in .tmp/employee-phones.csv (header: full_name,phone_number)');
    console.error('Or pass --csv=/path/to/file.csv');
    process.exit(1);
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0]!.toLowerCase();
  if (!header.includes('full_name') || !header.includes('phone_number')) {
    console.error(`CSV header must contain "full_name" and "phone_number". Got: ${lines[0]}`);
    process.exit(1);
  }
  return lines.slice(1).map((line) => {
    const [full_name, ...rest] = line.split(',');
    return { full_name: full_name!.trim(), phone_number: rest.join(',').trim() };
  });
}

const INPUT_LIST = loadInputList(CSV_PATH);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/,+\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** First word of normalized name (e.g. "tracer" from "Tracer Burnes"). */
function firstWord(normalizedName: string): string {
  const word = normalizedName.split(/\s+/)[0];
  return word ?? '';
}

type AppUserRow = { user_id: string; full_name: string | null; phone_number: string | null };

function buildNormalizedNameToRows(rows: AppUserRow[]): Map<string, AppUserRow[]> {
  const map = new Map<string, AppUserRow[]>();
  for (const row of rows) {
    const key = normalizeName(row.full_name ?? '');
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function header(msg: string): void {
  console.log('');
  console.log('─'.repeat(60));
  console.log(msg);
  console.log('─'.repeat(60));
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  header(DRY_RUN ? 'Sync app_users phones (DRY RUN — no writes)' : 'Sync app_users phones');

  const { data: users, error: fetchError } = await supabase
    .from('app_users')
    .select('user_id, full_name, phone_number');

  if (fetchError) {
    console.error('Failed to fetch app_users:', fetchError.message);
    process.exit(1);
  }

  const nameToRows = buildNormalizedNameToRows((users ?? []) as AppUserRow[]);

  const toUpdate: { inputName: string; phone: string; row: AppUserRow }[] = [];
  const couldNotUpdate: { name: string; reason: 'no_match' | 'multiple_matches' }[] = [];

  for (const { full_name: inputName, phone_number: phone } of INPUT_LIST) {
    const key = normalizeName(inputName);
    const exactRows = nameToRows.get(key) ?? [];

    let match: AppUserRow | null = null;
    if (exactRows.length === 1) {
      match = exactRows[0]!;
    } else if (exactRows.length === 0) {
      const firstNameKey = firstWord(key);
      const firstNamedRows = nameToRows.get(firstNameKey) ?? [];
      if (firstNamedRows.length === 1) {
        match = firstNamedRows[0]!;
      }
    }

    if (match) {
      toUpdate.push({ inputName, phone, row: match });
    } else if (exactRows.length > 1) {
      couldNotUpdate.push({ name: inputName, reason: 'multiple_matches' });
    } else {
      const firstNamedRows = nameToRows.get(firstWord(key)) ?? [];
      if (firstNamedRows.length > 1) {
        couldNotUpdate.push({ name: inputName, reason: 'multiple_matches' });
      } else {
        couldNotUpdate.push({ name: inputName, reason: 'no_match' });
      }
    }
  }

  console.log(`Input list: ${INPUT_LIST.length} names`);
  console.log(`Matched (single row): ${toUpdate.length}`);
  console.log(`Could not confidently update: ${couldNotUpdate.length}`);

  if (toUpdate.length > 0) {
    header(DRY_RUN ? 'Would update (old → new)' : 'Updating (old → new)');
    for (const { phone, row } of toUpdate) {
      const oldVal = row.phone_number ?? '(null)';
      console.log(`  ${row.full_name ?? row.user_id}: ${oldVal} → ${phone}`);
    }
  }

  if (!DRY_RUN && toUpdate.length > 0) {
    header('Applying updates');
    let ok = 0;
    let err = 0;
    for (const { row, phone } of toUpdate) {
      const { error } = await supabase
        .from('app_users')
        .update({ phone_number: phone })
        .eq('user_id', row.user_id);
      if (error) {
        console.error(`  FAIL ${row.full_name ?? row.user_id}: ${error.message}`);
        err++;
      } else {
        console.log(`  OK   ${row.full_name ?? row.user_id}`);
        ok++;
      }
    }
    console.log(`Done: ${ok} updated, ${err} errors.`);
  } else if (DRY_RUN && toUpdate.length > 0) {
    console.log('\nDry run: no changes written. Run without --dry-run to apply.');
  }

  if (couldNotUpdate.length > 0) {
    header('Could not confidently update');
    for (const { name, reason } of couldNotUpdate) {
      const reasonStr = reason === 'no_match' ? 'no match in app_users' : 'multiple rows with same name';
      console.log(`  ${name} (${reasonStr})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
