# Chunk 1 verification

**Date:** 2026-09-02 (updated 2026-09-09, Session 2)
**What shipped:** `sms_message_log` + `sms_message_log_compat` + `sendAndLogSMS` / persist on all four send paths. `sendSMS()` POST URL, auth, and SUCCESS/THROTTLED handling unchanged.

## Correction: original migration was broken on Postgres 16

Chunk 1 originally claimed the migration was verified. That was **text-only** (unit tests asserting SQL string contents). The shipped `sms_compat_uuid` body used:

```sql
SELECT CAST(CAST(('x' || md5(p_seed)) AS bit(128)) AS uuid);
```

On PostgreSQL 16 this aborts with `ERROR: cannot cast type bit to uuid`, so `supabase db push` fails before the compat view is created. Verified by applying the broken migration to a real Postgres 16 instance.

**Fix (2026-09-09):** replace that line with `SELECT md5(p_seed)::uuid;` — verified to apply cleanly end-to-end on Postgres 16.

## Local migration replay (throwaway PG16)

Executable regression (not string matching):

```bash
./scripts/test-sms-migration-local.sh
```

Starts throwaway `postgres:16` on `:5499`, stubs roles/helpers/legacy tables; seeds one realistic row each; applies `20260902200000_sms_message_log.sql`; asserts `sms_message_log_compat` returns exactly 3 rows with each `source_table` once.

**CI note (Session 2):** if Docker is absent or the daemon is down, the script now prints `SKIP:` and exits 0. It still exits non-zero on SQL assertion failure when Docker is available.

Actual output (2026-09-09, independently verified):

```
compat_row_count=3
source_tables=mass_sms_log,payroll_reminder_sms_log,sms_escalation_send_log
PASS: migration applied; sms_message_log_compat returned 3 rows (one per legacy source_table).
```

## Full migration chain vs baseline+forward (Session 2)

**`supabase db reset` / full 170-migration replay from zero: FAILED (known).**

`supabase start` with migrations present aborts on `20241205_job_tracker.sql` (`relation "public.app_users" does not exist`) — that file sorts before `20251102034653_create_app_users_table_and_trigger.sql`. This matches `docs/CONVENTIONS.md`: the project does **not** replay the historical chain from zero.

**What was run instead (authoritative for this repo):**

```bash
bash supabase/.localgate/run.sh
```

Result:

```
GATE PASSED ✓  (baseline=prod schema+config, +11 forward migration(s), verify OK)
```

Forward migrations applied in order (anchor `20260608230400`), including:

1. `20260902120000_field_audit_submit_pipeline.sql`
2. `20260902130000_field_audit_escalate_site_scope.sql`
3. `20260902200000_sms_message_log.sql`

**No ordering problem** between the two Sept 2 field-audit migrations and the SMS migration — SMS sorts after both and applied cleanly in the forward set.

Local Supabase stack (Colima) was then started with migrations temporarily stashed (empty public schema), and the verified `atts_gate` public schema was loaded into `postgresql://postgres@127.0.0.1:54322/postgres` for Edge Function + E2E work. Analytics/vector/mailpit excluded (Colima docker.sock mount issue).

## Compat view against seeded local data (Session 2)

Seeded into `atts_gate` (then loaded into local Supabase):

- 1× `sms_escalation_send_log` (tier 1, results array)
- 1× `payroll_reminder_sms_log` (nested `clicksend_results`)
- 1× `mass_sms_log` (run-level blast)
- 2× `sms_message_log` live rows (one with `user_id`, one phone-only)
- 2× `app_users` (+ matching `auth.users`) for join simulation

Actual `sms_message_log_compat` output:

| source | message_type | category | phone_e164 | user_id |
|---|---|---|---|---|
| sms_message_log | safety_briefing_reminder | operational | +15551234001 | 11111111-… |
| payroll_reminder_sms_log | payroll_reminder | operational | +15551234002 | null |
| sms_escalation_send_log | safety_briefing_escalation_t1 | operational | +15551234001 | null |
| sms_message_log | safety_briefing_escalation_t2 | operational | +15559876543 | null |
| mass_sms_log | mass_sms | marketing | null | null |

Export join simulation:

| message_type | recipient_display | role_display |
|---|---|---|
| safety_briefing_reminder | Casey Crew | employee |
| payroll_reminder | ***4002 | static |
| safety_briefing_escalation_t1 | ***4001 | static |
| safety_briefing_escalation_t2 | ***6543 | static |
| mass_sms | — | static |

Confirms: unnesting, per-tier `message_type` mapping, name join when `user_id` present, phone last-4 fallback when null. Legacy mass rows remain run-level (`phone_e164` null by design).

## Function dry-run (Session 2 — local stack)

Served via `supabase functions serve … --env-file .tmp/functions-sms.env --no-verify-jwt`.

**Auth note:** `supabase status -o env` `SERVICE_ROLE_KEY` ≠ runtime `SUPABASE_SERVICE_ROLE_KEY` inside the edge container on this CLI version. Invocations used the **runtime** key (`docker exec … printenv SUPABASE_SERVICE_ROLE_KEY`). `--env-file` cannot override `SUPABASE_*` (CLI skips those names).

| Function | Eligible / would-send | Sample body | Unified `sms_message_log` | Legacy tables |
|---|---|---|---|---|
| `safety-briefing-reminder-sms` | `sent: 2`, `dryRun: true` | `ATTS Safety: Good morning Casey — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.` | 2 rows, `provider_status=DRY_RUN`, `is_dry_run=true` | **unchanged** |
| `safety-briefing-escalation-sms` | tier1 overdue=2 `dryRunWouldSend=true`; tier2 overdue=2 `dryRunWouldSend=true` | tier1: `ATTS Safety Briefing\n2 of 2 crew members did not complete the Sep 9 briefing:\nCasey C., Fran F.\nPlease follow up…`; tier2: `…Immediate follow-up required…` | 2 rows (`…_t1`, `…_t2`), `DRY_RUN` | **unchanged** |
| `payroll-hours-reminder-sms` | `eligible_count: 3` (force_day=1) | `ATTS: Hi Casey, friendly reminder to submit your payroll hours before Saturday. Open the ATTS app, Forms, Payroll Form. Reply STOP to opt out.` | 3 rows, `DRY_RUN` | **unchanged** |
| `send-mass-sms` | `countWithPhone: 3` (dry-run early preview; no send path) | Request body: `Team reminder: toolbox talk at 7.` (preview path does not write unified rows) | no new rows (by design of dry-run count preview) | **unchanged** |

Legacy counts before→after dry-run batch: `esc 1→1`, `pay 1→1`, `mass 1→1`. No ClickSend POST (dry-run short-circuits inside `sendAndLogSMS` before `sendSMS`).

### Dry-run fix found during verification

Escalation **zero-overdue audit** inserts into `sms_escalation_send_log` were missing `!dryRun` (reminder already guarded). Fixed in Session 2 on both lookback and single-day paths so dry-run never writes legacy logs.

## Unit tests

`npx vitest run --config tests/vitest.config.ts tests/unit/sms-message-log.test.ts`

- Builder matches provider results by index, parses price, snapshots opt-out, passes `run_id`.
- Dry-run helper sets `provider_status = DRY_RUN` and `is_dry_run = true`.
- Migration SQL contains UNION ALL of the three legacy sources plus `is_admin()` RLS.

## Code-level no-behavior-change checks

| Path | Recipient query changed? | Message body changed? | Live POST changed? |
|---|---|---|---|
| Reminder | SELECT added opt-out columns (not used as filters). New dryRun short-circuit; cron empty body still live. | No | No (`sendAndLogSMS` → `sendSMS`) |
| Escalation | Manager SELECT added `user_id` + opt-out columns (not used as filters). | No | No |
| Payroll | SELECT added marketing opt-out column (not used as filter). `x-dry-run` header now honored in addition to body. | No | No |
| Mass | SELECT added operational opt-out column (not used as filter). Recipients still skip marketing opt-out only. Still includes `@atts.test`. | No | No (`sendSMS` still used in the batch loop) |

Legacy tables: still written on live sends; still **not** written on dry-run after Session 2 escalation zero-overdue guard fix.
