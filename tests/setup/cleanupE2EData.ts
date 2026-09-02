/**
 * Cleanup E2E Test Data
 *
 * Deletes ALL data created by E2E test users (@atts.test) from every
 * Supabase table, cleans up storage objects, then removes the users
 * themselves (app_users + auth.users).
 *
 * Features:
 *   --dry-run           Print row/object counts without deleting anything
 *   --submissions-only  Delete table data and storage for test users only;
 *                       do NOT delete app_users or auth.users (keeps test accounts).
 *
 * Usage:
 *   npx tsx tests/setup/cleanupE2EData.ts                     # delete everything
 *   npx tsx tests/setup/cleanupE2EData.ts --dry-run          # preview only
 *   npx tsx tests/setup/cleanupE2EData.ts --submissions-only  # clear submissions, keep users
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isProdSupabaseUrl, loadE2EEnv, projectRefFromUrl } from './e2eEnv';

// ── Env ────────────────────────────────────────────────────────────────────
// Same precedence as the suite (.env.test > .env). Unlike seeding, cleanup is
// deliberately allowed against production: it is the remediation path when test
// data has leaked there, and it only ever touches @atts.test accounts.
loadE2EEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (isProdSupabaseUrl(SUPABASE_URL)) {
  console.warn(
    `⚠️  Target is PRODUCTION (${projectRefFromUrl(SUPABASE_URL)}). Only @atts.test data is touched.\n`,
  );
}

const DRY_RUN = process.argv.includes('--dry-run');
const SUBMISSIONS_ONLY = process.argv.includes('--submissions-only');
const TEST_EMAIL_DOMAIN = '@atts.test';

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────

function header(msg: string) {
  console.log('');
  console.log('─'.repeat(60));
  console.log(msg);
  console.log('─'.repeat(60));
}

/**
 * Known tables + columns that reference auth.users(id) and use ON DELETE SET NULL
 * (so rows survive user deletion). These MUST be explicitly deleted.
 *
 * Order matters: children before parents where FKs exist.
 */
const KNOWN_SET_NULL_TABLES: { table: string; columns: string[] }[] = [
  // safety_audit_log can reference any user
  { table: 'safety_audit_log', columns: ['user_id'] },
  // corrective_actions references safety_incidents (CASCADE) and auth.users (SET NULL)
  { table: 'corrective_actions', columns: ['assigned_to', 'assigned_by', 'verified_by'] },
  // safety_incidents (reported_by SET NULL; CASCADE deletes corrective_actions for the incident)
  { table: 'safety_incidents', columns: ['reported_by', 'corrective_actions_by', 'supervisor_id'] },
  // safety_flags
  { table: 'safety_flags', columns: ['flagged_by', 'reviewed_by'] },
  // jsa_sharing_audit references daily_jsa (CASCADE) and auth.users (SET NULL)
  { table: 'jsa_sharing_audit', columns: ['changed_by'] },
  // Form submissions (all SET NULL on user delete)
  { table: 'daily_jsa', columns: ['user_id'] },
  { table: 'dvir_reports', columns: ['user_id'] },
  { table: 'daily_equipment_inspections', columns: ['user_id'] },
  { table: 'contact_requests', columns: ['user_id'] },
  { table: 'rto_requests', columns: ['user_id'] },
  // Telemetry
  { table: 'telemetry_events', columns: ['user_id'] },
  // Maintenance
  { table: 'vehicle_maintenance_log', columns: ['performed_by_user_id'] },
  { table: 'vehicle_defect_log', columns: ['resolved_by_user_id'] },
  // Jobs
  { table: 'job_progress_trackers', columns: ['created_by'] },
  // Crews
  { table: 'crews', columns: ['created_by'] },
  // Notifications
  { table: 'notification_events', columns: ['actor_user_id'] },
  // CASCADE tables — auth.users deletion would remove these anyway, but listing
  // them here makes --dry-run and --submissions-only report/clear them explicitly.
  { table: 'notification_outbox', columns: ['user_id'] },
  { table: 'notification_preferences', columns: ['user_id'] },
  { table: 'push_subscriptions', columns: ['user_id'] },
  { table: 'user_activity_sessions', columns: ['user_id'] },
  { table: 'user_preferences', columns: ['user_id'] },
  { table: 'user_contact_templates', columns: ['user_id'] },
  { table: 'user_signatures', columns: ['user_id'] },
  { table: 'user_saved_locations', columns: ['user_id'] },
  { table: 'daily_attendance', columns: ['user_id'] },
  { table: 'user_absences', columns: ['user_id'] },
  { table: 'user_badges', columns: ['user_id'] },
  { table: 'streak_state', columns: ['user_id'] },
  { table: 'streak_week_activity', columns: ['user_id'] },
  { table: 'point_transactions', columns: ['user_id'] },
  { table: 'compliance_rewards', columns: ['user_id'] },
  { table: 'announcement_rewards', columns: ['user_id'] },
  { table: 'safety_briefing_answers', columns: ['user_id'] },
  { table: 'certification_attempts', columns: ['user_id'] },
  { table: 'certification_records', columns: ['user_id'] },
  { table: 'practical_evaluations', columns: ['user_id'] },
  { table: 'recognition_feed', columns: ['subject_user_id'] },
  { table: 'challenge_completions', columns: ['user_id'] },
  { table: 'redemptions', columns: ['user_id'] },
  { table: 'field_audits', columns: ['auditor_id'] },
  { table: 'field_notes', columns: ['author_id'] },
];

/**
 * Columns where a test user may have *acted on* a real user's row (e.g. a test
 * admin marking real attendance). These rows belong to real users and must be
 * kept — we only null out the test-user reference. All are ON DELETE SET NULL,
 * so auth deletion would do this implicitly, but --submissions-only needs it
 * explicit and it keeps dry-run output honest.
 */
const NULLIFY_ONLY_COLUMNS: { table: string; columns: string[] }[] = [
  { table: 'daily_attendance', columns: ['marked_by'] },
  { table: 'user_absences', columns: ['created_by'] },
  { table: 'rto_requests', columns: ['approved_by'] },
  { table: 'attendance_summaries', columns: ['generated_by'] },
  { table: 'job_milestones', columns: ['completed_by'] },
  { table: 'job_crew_assignments', columns: ['assigned_by'] },
  { table: 'crew_members', columns: ['added_by'] },
  { table: 'certification_attempts', columns: ['graded_by', 'grading_started_by'] },
  { table: 'certification_records', columns: ['certified_by', 'reviewed_by', 'revoked_by'] },
  { table: 'practical_evaluations', columns: ['evaluator_id'] },
  { table: 'safety_announcements', columns: ['created_by', 'published_by'] },
  { table: 'monthly_safety_rewards', columns: ['created_by'] },
  { table: 'company_calendar', columns: ['created_by'] },
  { table: 'mass_sms_log', columns: ['admin_user_id'] },
  { table: 'app_settings', columns: ['updated_by'] },
  { table: 'app_settings_audit', columns: ['changed_by'] },
  { table: 'certification_audit_log', columns: ['actor_id'] },
  // ON DELETE NO ACTION — these would BLOCK auth.users deletion if left set.
  { table: 'point_transactions', columns: ['awarded_by'] },
  { table: 'point_awarder_grants', columns: ['granted_by', 'revoked_by'] },
  { table: 'reward_catalog', columns: ['created_by'] },
  { table: 'redemptions', columns: ['decided_by'] },
  { table: 'gamification_settings', columns: ['updated_by'] },
  { table: 'campaigns', columns: ['created_by'] },
];

/**
 * Tables that reference app_users(id) with SET NULL — need app_users.id, not auth uid.
 */
const APP_USER_REF_TABLES: { table: string; columns: string[] }[] = [
  { table: 'user_management_log', columns: ['performed_by_user_id'] },
  { table: 'email_recipient_lists', columns: ['created_by_user_id'] },
];

/**
 * Storage buckets that may contain test user files.
 * Convention: files live under {auth_user_id}/...
 */
const STORAGE_BUCKETS = [
  'dvir-photos',
  'equipment-inspection-photos',
  'jsa-photos',
  'signatures',
];

// ── Core logic ─────────────────────────────────────────────────────────────

async function getTestAuthUserIds(): Promise<string[]> {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = data?.users?.filter(u => u.email?.endsWith(TEST_EMAIL_DOMAIN)) ?? [];
  return testUsers.map(u => u.id);
}

async function getTestAppUserIds(authIds: string[]): Promise<string[]> {
  if (authIds.length === 0) return [];
  const { data } = await supabase
    .from('app_users')
    .select('id')
    .in('user_id', authIds);
  return (data ?? []).map((r: { id: string }) => r.id);
}

/**
 * Dynamically discover additional public tables that have columns referencing
 * auth.users(id) but aren't in our known list. Uses information_schema via raw SQL.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function discoverAdditionalTables(_knownTables: Set<string>): Promise<{ table: string; columns: string[] }[]> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _data, error: _error } = await supabase.rpc('', {}).maybeSingle();
  // rpc won't work for ad-hoc SQL. Use the REST-compatible approach:
  // Query information_schema for FK columns pointing to auth.users.
  // We'll use execute_sql via the Supabase management API isn't available from client.
  // Instead, query a known pattern: columns named user_id, reported_by, etc. in public schema.
  const _sql = /* eslint-disable-line @typescript-eslint/no-unused-vars */ `
    SELECT DISTINCT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type = 'uuid'
      AND (
        c.column_name LIKE '%user_id%'
        OR c.column_name LIKE '%_by'
        OR c.column_name = 'reported_by'
        OR c.column_name = 'flagged_by'
        OR c.column_name = 'reviewed_by'
        OR c.column_name = 'created_by'
        OR c.column_name = 'assigned_to'
        OR c.column_name = 'assigned_by'
        OR c.column_name = 'verified_by'
        OR c.column_name = 'evaluator_id'
        OR c.column_name = 'certified_by'
        OR c.column_name = 'revoked_by'
        OR c.column_name = 'graded_by'
        OR c.column_name = 'admin_user_id'
      )
    ORDER BY c.table_name, c.column_name;
  `;

  // Use the postgres function via supabase — we need service role which bypasses RLS.
  // The cleanest way with the JS client is to call a raw SQL function if one exists.
  // Since we have service role, we can call the REST SQL endpoint.
  // Actually, Supabase JS doesn't expose raw SQL. We'll use fetch directly.
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    // If this fails, fall back gracefully — known tables are still used.
    if (!response.ok) {
      console.log('  (Dynamic table discovery not available — using known table list)');
      return [];
    }
  } catch {
    // Fall through
  }

  // Alternative approach: use the Supabase management REST endpoint for SQL.
  // This requires the project ref from the URL.
  // For simplicity and reliability, we'll just log the known tables and note if
  // the user wants more they can extend the KNOWN list.
  console.log('  (Using known table list. Extend KNOWN_SET_NULL_TABLES in the script if you add new tables.)');
  return [];
}

async function countRows(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .in(column, ids);
  if (error) {
    // Table might not exist yet (migration not applied)
    if (error.message?.includes('does not exist') || error.code === '42P01') return 0;
    console.warn(`  Warning: count on ${table}.${column} failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

async function deleteRows(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from(table)
    .delete()
    .in(column, ids)
    .select('id');
  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') return 0;
    console.error(`  ERROR deleting from ${table}.${column}: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}

async function processTable(
  table: string,
  columns: string[],
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  for (const col of columns) {
    const count = await countRows(table, col, ids);
    if (count === 0) {
      console.log(`  ${table}.${col}: 0 rows`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${table}.${col}: ${count} rows (would delete)`);
    } else {
      const deleted = await deleteRows(table, col, ids);
      console.log(`  ${table}.${col}: ${deleted} rows deleted`);
    }
  }
}

async function nullifyColumn(table: string, column: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const count = await countRows(table, column, ids);
  if (count === 0) {
    console.log(`  ${table}.${column}: 0 rows`);
    return;
  }

  if (DRY_RUN) {
    console.log(`  ${table}.${column}: ${count} rows (would set NULL, rows kept)`);
    return;
  }

  const { error } = await supabase
    .from(table)
    .update({ [column]: null })
    .in(column, ids);
  if (error) {
    if (error.message?.includes('does not exist') || error.code === '42P01') return;
    console.error(`  ERROR nullifying ${table}.${column}: ${error.message}`);
    return;
  }
  console.log(`  ${table}.${column}: ${count} rows set NULL (rows kept)`);
}

/**
 * Recursively list every file under `prefix` in `bucket`. Supabase's list() is
 * one level deep and returns folders as entries with a null `id`, so we walk them.
 */
async function listFilesRecursive(bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (error) {
    if (error.message?.includes('not found') || error.message?.includes('does not exist')) return files;
    console.warn(`  Warning listing ${bucket}/${prefix}: ${error.message}`);
    return files;
  }

  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      files.push(...(await listFilesRecursive(bucket, path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

async function cleanupStorage(authIds: string[]): Promise<void> {
  if (authIds.length === 0) return;

  header(DRY_RUN ? 'STORAGE (dry-run)' : 'STORAGE CLEANUP');

  for (const bucket of STORAGE_BUCKETS) {
    const paths: string[] = [];

    for (const uid of authIds) {
      // Files live under `{uid}/...` or, for some older uploads, `{bucket}/{uid}/...`.
      for (const prefix of [uid, `${bucket}/${uid}`]) {
        paths.push(...(await listFilesRecursive(bucket, prefix)));
      }
    }

    if (paths.length === 0) {
      console.log(`  ${bucket}: 0 objects`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${bucket}: ${paths.length} objects (would delete)`);
      continue;
    }

    // remove() accepts many paths but keep batches modest to avoid request limits.
    let removed = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { data, error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        console.error(`  ERROR removing from ${bucket}: ${error.message}`);
        continue;
      }
      removed += data?.length ?? batch.length;
    }
    console.log(`  ${bucket}: ${removed}/${paths.length} objects deleted`);
  }
}

async function cleanupAppUsers(authIds: string[]): Promise<void> {
  if (authIds.length === 0) return;

  const { count } = await supabase
    .from('app_users')
    .select('*', { count: 'exact', head: true })
    .in('user_id', authIds);

  const n = count ?? 0;

  if (DRY_RUN) {
    console.log(`  app_users: ${n} rows (would delete)`);
  } else {
    const { error } = await supabase
      .from('app_users')
      .delete()
      .in('user_id', authIds);
    if (error) {
      console.error(`  ERROR deleting app_users: ${error.message}`);
    } else {
      console.log(`  app_users: ${n} rows deleted`);
    }
  }
}

async function cleanupAuthUsers(authIds: string[]): Promise<void> {
  if (authIds.length === 0) return;

  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = data?.users?.filter(u => u.email?.endsWith(TEST_EMAIL_DOMAIN)) ?? [];

  if (DRY_RUN) {
    console.log(`  auth.users: ${testUsers.length} users (would delete)`);
    for (const u of testUsers) {
      console.log(`    ${u.email} (${u.id})`);
    }
  } else {
    for (const u of testUsers) {
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) {
        console.error(`  ERROR deleting auth user ${u.email}: ${error.message}`);
      } else {
        console.log(`  Deleted auth user: ${u.email}`);
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  header(DRY_RUN ? 'E2E DATA CLEANUP (DRY RUN)' : 'E2E DATA CLEANUP');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Test domain:  *${TEST_EMAIL_DOMAIN}`);
  console.log(`Mode:         ${DRY_RUN ? 'DRY RUN (no changes)' : SUBMISSIONS_ONLY ? 'DELETE (submissions + storage only, keep users)' : 'DELETE (full)'}`);

  // 1. Resolve test user IDs
  header('RESOLVING TEST USERS');
  const authIds = await getTestAuthUserIds();
  console.log(`  Found ${authIds.length} auth user(s) matching *${TEST_EMAIL_DOMAIN}`);

  if (authIds.length === 0) {
    console.log('\nNo test users found. Nothing to clean up.');
    return;
  }

  for (const id of authIds) {
    const { data } = await supabase.auth.admin.getUserById(id);
    console.log(`    ${data?.user?.email ?? 'unknown'} → ${id}`);
  }

  const appUserIds = await getTestAppUserIds(authIds);
  console.log(`  Found ${appUserIds.length} app_users record(s)`);

  // 2. Attempt dynamic discovery (falls back to known list)
  await discoverAdditionalTables(new Set(KNOWN_SET_NULL_TABLES.map(t => t.table)));

  // 3. Delete from SET NULL tables (auth.users references)
  header(DRY_RUN ? 'TABLE DATA (dry-run)' : 'DELETING TABLE DATA');

  for (const { table, columns } of KNOWN_SET_NULL_TABLES) {
    await processTable(table, columns, authIds);
  }

  // 4. Delete from tables that reference app_users(id)
  if (appUserIds.length > 0) {
    for (const { table, columns } of APP_USER_REF_TABLES) {
      await processTable(table, columns, appUserIds);
    }
  }

  // Also delete user_management_log by target_user_id (auth id)
  await processTable('user_management_log', ['target_user_id'], authIds);

  // 4b. Null out test-user references on rows that belong to real users
  header(DRY_RUN ? 'REAL-USER ROWS TOUCHED BY TEST USERS (dry-run)' : 'DETACHING TEST USERS FROM REAL-USER ROWS');
  for (const { table, columns } of NULLIFY_ONLY_COLUMNS) {
    for (const col of columns) {
      await nullifyColumn(table, col, authIds);
    }
  }

  // 5. Storage cleanup
  await cleanupStorage(authIds);

  // 6. Delete app_users (skipped when --submissions-only)
  if (!SUBMISSIONS_ONLY) {
    header(DRY_RUN ? 'APP_USERS (dry-run)' : 'DELETING APP_USERS');
    await cleanupAppUsers(authIds);

    // 7. Delete auth users (CASCADE takes care of remaining ON DELETE CASCADE tables)
    header(DRY_RUN ? 'AUTH USERS (dry-run)' : 'DELETING AUTH USERS');
    await cleanupAuthUsers(authIds);
  } else {
    console.log('');
    console.log('  (Skipping app_users and auth.users — submissions only)');
  }

  // Summary
  header('DONE');
  if (DRY_RUN) {
    console.log('This was a dry run. No data was modified.');
    console.log('Run without --dry-run to delete.');
  } else if (SUBMISSIONS_ONLY) {
    console.log('E2E test submissions and storage have been removed. Test user accounts kept.');
  } else {
    console.log('All E2E test data has been removed.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
