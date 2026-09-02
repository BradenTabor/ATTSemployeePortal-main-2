# SMS Pipeline Upgrade — Discovery Report

**Date:** 2026-09-02
**Branch:** `feat/sms-upgrade`
**Method:** Code + migration + `prod_schema.sql` review. ClickSend account API and ATTS production DB were not reachable from this session.

## Findings verification

Each item from `00-BUILD-BRIEF.md` “Where things live today” and Change Request A.3. Verdict is CONFIRMED / PARTIALLY CORRECT / WRONG with file:line evidence. HYPOTHESIS items are called out, not softened.

### Sending

| Finding | Verdict | Evidence |
|---|---|---|
| Shared helper `sendSMS` in `_shared/clicksend.ts` is the single POST choke point; SUCCESS + THROTTLED = success | CONFIRMED | `supabase/functions/_shared/clicksend.ts:9` URL; `:42` `sendSMS`; `:133–135` success statuses |
| Reminder (Tier 0) Mon–Fri 10:40 UTC, default from `+18443781444` | CONFIRMED | `safety-briefing-reminder-sms/index.ts:5–6,21` |
| Escalation four `sendSMS(` sites ~L525/582/836/894, default from `+18443781444` | CONFIRMED | `safety-briefing-escalation-sms/index.ts:523,580,834,892` (lines drifted by 1–2 vs the brief) |
| Payroll Thu/Fri/Sat 8 AM Central, kill switch `payroll_reminder_sms_config`, default from `+18443781444` | CONFIRMED | `payroll-hours-reminder-sms/index.ts:5–6,21,168–180`; `docs/PAYROLL_SMS_REMINDER.md` |
| Mass SMS admin JWT, dry-run by default, 15-min cooldown, batches of 500, **default `from` is `""`** | CONFIRMED | `send-mass-sms/index.ts:6–8,26–28,91,178–181` |
| Cron inventory in `docs/cron-jobs-inventory.md` | CONFIRMED | rows for reminder 10:40 UTC, escalation 16:00 UTC, payroll utc13/utc14 |
| HYPOTHESIS: two production `from` numbers = dedicated `+18443781444` vs ClickSend default when mass `from` is unset | HYPOTHESIS (unresolved) | Code matches the hypothesis. `mass_sms_log.batch_details` stores `{index,sent,failed,error}` only — **no `from`**. Escalation/payroll `results` store `{to,status,messageId,price}` — **no `from`**. ClickSend history was not readable this session. |
| “Every function already has a dryRun pattern” (ground rule 2) | WRONG | Reminder has **no** `dryRun` / `x-dry-run` handling at all (`safety-briefing-reminder-sms/index.ts` — no matches). Escalation: body + `x-dry-run` (`:233–236`). Payroll: **body only** `dryRun === true` (`:152`), no header. Mass: body, default dry-run (`:91`). |
| Newest migration prefix is `20260627170000` | WRONG | `20260627170000_restore_corrective_actions_audit_branch.sql` exists, but later files `20260902120000_field_audit_submit_pipeline.sql` and `20260902130000_field_audit_escalate_site_scope.sql` already sort after it. Chunk 1 will use `20260902200000_…`. |

### Logging

| Finding | Verdict | Evidence |
|---|---|---|
| `sms_escalation_send_log` created `20260310000005`, extended `20260310130000` (orphans + suppression) | PARTIALLY CORRECT | Those two are right; **also** `20260310120000` adds `employee_user_ids` and widens tier CHECK to include 0. Prod columns (`prod_schema.sql:13686–13700`): `id, tier, date_checked, overdue_count, recipient_count, sent_at, success, error_message, total_price, results, employee_user_ids, orphaned_user_ids, suppression_log`. |
| `mass_sms_log` one row per blast, no per-recipient rows | CONFIRMED | `20260320120000_sms_opt_out_and_mass_sms_log.sql:20–29`; `prod_schema.sql:12415–12426`. Drift: migration has `admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL`; prod has `admin_user_id uuid` nullable, no FK in the CREATE TABLE dump. |
| `payroll_reminder_sms_log` one row per (date, tier); claim RPC | CONFIRMED | `20260521120000_payroll_hours_reminder_sms.sql:17–28,51`; `prod_schema.sql:12773–12784`. No drift vs prod. |
| `payroll_sms_cron_monitoring` exists | CONFIRMED | `20260521130000_payroll_sms_cron_monitoring.sql` |
| None of the three log tables is referenced from `src/` | CONFIRMED | `grep` of `src/` for the three table names: no matches |
| Comment on `employee_user_ids` mentions future `sms_escalation_send_recipients` | CONFIRMED as leftover | `prod_schema.sql:13731`. **Table does not exist.** |

### Opt-out / phone / consent

| Finding | Verdict | Evidence |
|---|---|---|
| `sms_marketing_opt_out` excludes mass SMS | CONFIRMED | Column: `20260320120000:9–13`. Read: `send-mass-sms/index.ts:105,118,158`. |
| `sms_operational_opt_out` excluded from payroll and “should be honored by all operational sends” | PARTIALLY CORRECT | Payroll **does** read it (`payroll-hours-reminder-sms/index.ts:214,229`). Reminder **does not** select or check it (`safety-briefing-reminder-sms/index.ts:150`). Escalation **does not** (`safety-briefing-escalation-sms` — zero matches). Chunk 1 must **not** add those checks (no behavior change). |
| Phone added `20260308100000`, normalized `20260310130003`, backfilled from auth `20260320120001`; no consent record | CONFIRMED | Those three migrations. Extra normalize pass in `20260521120000:100`. |
| No inbound webhook function in `supabase/functions/` | CONFIRMED | No `clicksend-*` function. Inbound STOP gap documented at `docs/PAYROLL_SMS_REMINDER.md:101`. |
| Phone is touched in UI at `Home.tsx`, `TeamContacts.tsx`, `AdminRTO.tsx` | WRONG | `src/pages/Home.tsx` has **no** `phone` references. Signup write is `src/pages/home/useAuthForm.ts:98` (`signUp` `options.data.phone_number`). `TeamContacts.tsx:78,348–355` **read** only. `AdminRTO.tsx:41,638` reads `rto_requests.phone_number`, not `app_users`. Profile page has no phone field. |
| A.3: no inbound opt-out sync | CONFIRMED | Same as webhook finding |
| A.3: fragmented audit trail (three tables, no single person/date query) | CONFIRMED | Different grains: per-run vs per-blast vs per-(date,tier). Mass has no recipient list. |
| A.3: no SMS section in ComplianceDataExportPanel | CONFIRMED | `ComplianceDataExportPanel.tsx:462+` sections are DVIR/JSA/equipment/mechanic/compliance/incidents/RTO/rewards/certs — no SMS |
| A.3: consent provenance gap (auth backfill) | CONFIRMED | `20260320120001_backfill_app_users_phone_from_auth.sql` |
| A.3: sender number governance undocumented; two numbers | CONFIRMED as undocumented / HYPOTHESIS as “two numbers in use” | Only one hardcoded default in repo. Mass unset `from` is the plausible second source. |
| A.3: A2P 10DLC status undocumented | CONFIRMED | No 10DLC string in repo. API also cannot confirm (see ClickSend facts). |
| A.3: cert-expiry is email/push only; heat index is frontend-only | CONFIRMED | `cert-expiry-reminders/index.ts`; `src/components/safety/HeatIllnessAlert.tsx:13` `heatIndexF` |

**Counts:** CONFIRMED 18 · PARTIALLY CORRECT 3 · WRONG 3 · HYPOTHESIS 1 (two-number production use). None of the WRONG items change Chunk 1’s unified-log design (filename prefix and reminder dryRun are additive).

## Inventory

### a. `sendSMS()` call sites and `from`

| Site | File:line | `from` resolves to |
|---|---|---|
| Definition | `_shared/clicksend.ts:42` | `m.from ?? config.from`; omitted from payload if falsy (`:66–67`) |
| Reminder (1) | `safety-briefing-reminder-sms/index.ts:233` | `CLICKSEND_FROM_NUMBER` default `+18443781444` (`:21`) |
| Escalation T1 legacy | `safety-briefing-escalation-sms/index.ts:523` | same default (`:28`) |
| Escalation T2 legacy | `:580` | same |
| Escalation T1 single_day | `:834` | same |
| Escalation T2 single_day | `:892` | same |
| Payroll (batched) | `payroll-hours-reminder-sms/index.ts:350` | default `+18443781444` (`:21`) |
| Mass (batched 500) | `send-mass-sms/index.ts:178` | `CLICKSEND_FROM_NUMBER` or undefined with env default empty (`:26`) — ClickSend picks the account default sender |

### b. Places `app_users.phone_number` is written

| Kind | Path |
|---|---|
| Column add + `handle_new_user()` sync from `raw_user_meta_data->>'phone_number'` | `supabase/migrations/20260308100000_add_phone_number_to_app_users.sql:5,23,32,51` |
| E.164 normalize | `20260310130003_normalize_app_users_phone_numbers.sql`; again `20260521120000:100` |
| Backfill from `auth.users` | `20260320120001_backfill_app_users_phone_from_auth.sql` |
| Signup metadata (trigger write) | `src/pages/home/useAuthForm.ts:98` |
| Admin/ops CSV sync | `scripts/sync-app-users-phones.ts:174` |

Not writes: `TeamContacts.tsx`, `AdminRTO.tsx` (RTO table), `Home.tsx`, `Profile.tsx`.

### c. Opt-out flag reads / send paths that skip them

**Reads**

- `sms_marketing_opt_out`: `send-mass-sms/index.ts:105,118,158` only.
- `sms_operational_opt_out`: `payroll-hours-reminder-sms/index.ts:214,229` only.

**Send paths that do NOT check the relevant flag**

- Reminder (operational) — no opt-out column in the user select (`:150`).
- Escalation T1/T2 (operational) — managers + static `sms_escalation_recipients`; no opt-out check.
- Mass does not exclude `@atts.test` (`baseRecipientFilter` at `:102–111` has no `email NOT ILIKE` filter). Payroll and reminder do.

Chunk 1 does not change any of these filters.

### d. Current columns vs migrations (drift)

See Logging table above. Material drift: `mass_sms_log.admin_user_id` NOT NULL+FK in migration vs nullable/no FK in `prod_schema.sql`. Escalation log gained `employee_user_ids` in a migration the brief omitted. Payroll log matches.

### e. Existing Edge Functions that receive an external webhook

There is **no ClickSend inbound function**. Closest patterns:

| Function | Trigger | Auth |
|---|---|---|
| `notify-admins-new-signup` | Supabase Database Webhook on `app_users` INSERT | `x-internal-key` == `INTERNAL_SECRET`, or Bearer `INTERNAL_SECRET` / service role. GET unauthenticated for Dashboard URL probe (`index.ts:49–70`) |
| `admin-create-notification` | Dual: user JWT **or** `x-internal-key`; accepts `{ type, table, record }` webhook payload | `index.ts:9–10,94–106` |
| `notifications-worker` | Internal | `x-internal-key` (`index.ts:11,87`) |

No `supabase/config.toml` in repo (no `verify_jwt = false` records). Chunk 3 should follow `notify-admins-new-signup`: `--no-verify-jwt` at deploy time + `x-internal-key` (or a dedicated ClickSend signing secret) inside the function.

### f. `ExportColumn` / `DataExporter` shape used by `ComplianceDataExportPanel`

`src/lib/exportUtils.ts:36–47`: `ExportColumn<T>` has `header`, `key`, optional `format`, `width`, `includeInPdf`.

Panel sections (`ComplianceDataExportPanel.tsx:54–65,67–152,462+`): `id, title, description, columns, pdfColumns?, reportType, filenamePrefix, fetchData(from,to), getRowCount`. Load → count → `DataExporter.exportCSV` / `exportPDF` → `logReportExported` (`src/lib/safetyAuditLog.ts:21`).

The skill reference `export-pattern.md` uses `accessor:` callbacks — that is **not** the live `ExportColumn` type. Chunk 2 must use `key` + optional `format`, matching the panel.

## ClickSend account facts

ClickSend read access unavailable in this session.

- `./scripts/clicksend-audit.sh` exited 2: `CLICKSEND_USERNAME` / `CLICKSEND_API_KEY` (or `CLICKSEND_PASSWORD`) are not set in the environment or `.env`. (The script originally sourced `.env` and crashed on an unquoted webhook URL; it now parses only `CLICKSEND_*` keys.)
- No `clicksend` MCP server is registered in this agent session (catalog search for `clicksend`: zero tools). `send-sms` was therefore never callable here.
- Supabase MCP is authenticated to other org projects (`wxftkrdwvzpggjrdntdf`, `vwilvdckfronjftrboje`), **not** `emqqxfzahmwnehxcpxzp`, so live `sms_*` log rows could not be queried.

Answers that need the account:

- (a) Which `from` numbers appear in outbound history — unknown. Code-level: three crons default `+18443781444`; mass omits `from` when the secret is unset.
- (b) Dedicated numbers on `/v3/numbers` — unknown.
- (c) Opt-out contact list / size / cross-check vs `app_users` — unknown. `prod_schema.sql` is DDL only (no phone seed data). Live-DB cross-check still needed.
- (d) Recent inbound STOP count — unknown.
- A2P 10DLC registration status — **confirm in dashboard / with ClickSend support** (not exposed by the ClickSend API).

## Design check

Target architecture items from the brief:

1. **Unified log in `_shared/clicksend.ts` (or a wrapper)** — **Agree.** Table `sms_message_log` (one row per recipient per send) + `sms_message_log_compat` view over unnested legacy rows that do not yet have a matching `run_id`. RLS: `is_admin()` SELECT; no INSERT policy (service role bypasses RLS), same as `mass_sms_log` / `payroll_reminder_sms_log`.
2. **Inbound opt-out webhook + nightly recon** — **Agree**, later chunk. Use `notify-admins-new-signup` auth pattern. STOP → both flags is a product question (see Open questions).
3. **Export section** — **Agree.** Must use `ExportColumn.key` + `format`, not the skill-doc `accessor` shape.
4. **Consent records** — **Agree**, later chunk. Phone write path to hook is `useAuthForm.ts`, not `Home.tsx`.
5. **Sender registry** — **Agree**, later chunk. Mass-SMS empty `from` is the first registry bug to close.
6. **Cert-expiry + heat-index SMS** — **Agree**, later chunks; port `heatIndexF` into Deno rather than importing the React file.

**Logging location decision:** a **wrapper `sendAndLogSMS()` in `_shared/clicksend.ts`**, not inside `sendSMS()` itself.

Reasons, given how the four functions batch:

- `sendSMS` has no Supabase client and must stay a pure ClickSend POST so live send behavior cannot drift.
- Reminder never calls `sendSMS` on a path we can hang dry-run logging from today (it has no dry-run). Escalation/payroll/mass **skip** `sendSMS` entirely when `dryRun` is set. Logging inside the POST helper would miss every dry-run and would still need call-site metadata (`user_id`, `message_type`, opt-out snapshot, `run_id`).
- Mass and payroll already batch 500: the wrapper logs each batch’s per-message results after `sendSMS` returns, then the call site attaches `run_id` from the legacy insert/claim (payroll already has `logId` before send; reminder/escalation/mass insert legacy after send, so the wrapper accepts `afterSend` to capture that id).
- Dry-run: wrapper skips POST, writes `is_dry_run = true`, `provider_status = 'DRY_RUN'`. Legacy tables are **not** written on dry-run (preserves payroll “no log row / no slot consumed” and escalation’s skip).

Disagree with putting inserts in each function without a shared helper — four call-site copies will drift (mass already has a different `from` default).

## Chunk 1 plan

**Goal:** additive `sms_message_log` + compat view + per-recipient logging on every existing send path. Zero change to who is messaged, message bodies, schedules, opt-out filters, or legacy log writes (except selecting `id` after insert so we can set `run_id`).

### Migration

File: `supabase/migrations/20260902200000_sms_message_log.sql` (sorts after `20260902130000`).

Table `sms_message_log`: `id`, `user_id` (auth uid, no FK), `phone_e164` (nullable so the compat view can emit run-level mass rows), `message_type`, `category` CHECK (`operational`|`marketing`), `from_number`, `body`, `template_key`, `provider_message_id`, `provider_status`, `price numeric(12,6)`, `opt_out_state_at_send jsonb`, `run_id` (legacy per-run id, no FK), `source_table`, `is_dry_run boolean not null default false`, `sent_at`, `created_at`, `updated_at`.

Indexes: `sent_at DESC`, `user_id`, `(run_id, source_table)`, `message_type`, `is_dry_run`. RLS enabled; policy `sms_message_log_admin_select` USING (`public.is_admin()`). Trigger `set_sms_message_log_updated_at` → `public.set_updated_at()`.

View `sms_message_log_compat` WITH (`security_invoker = true`) = live table UNION ALL unnest `sms_escalation_send_log.results` (array) where no matching live `run_id` UNION ALL unnest `payroll_reminder_sms_log.results->'clicksend_results'` where no matching live `run_id` UNION ALL one synthetic row per `mass_sms_log` blast (`phone_e164` NULL, `body` = `message_preview`) where no matching live `run_id`.

Historical mass blasts stay run-level in the view (no per-recipient data exists). New mass sends write per-recipient live rows. Dry-run vs live: `is_dry_run`. Exports (Chunk 2) must filter `is_dry_run = false`.

### Files changed

| File | How |
|---|---|
| `supabase/migrations/20260902200000_sms_message_log.sql` | new table, RLS, indexes, trigger, compat view |
| `supabase/functions/_shared/smsMessageLog.ts` | Deno-free row builder (`buildSmsMessageLogRows`) — unit-tested |
| `supabase/functions/_shared/clicksend.ts` | add `sendAndLogSMS` wrapping `sendSMS`; `sendSMS` POST path unchanged |
| `safety-briefing-reminder-sms/index.ts` | parse dryRun (body + `x-dry-run`); call wrapper; add dryRun without changing cron default (empty body → live) |
| `safety-briefing-escalation-sms/index.ts` | four sites → wrapper; select manager `user_id` for log metadata only; dry-run writes unified rows, still skips legacy insert |
| `payroll-hours-reminder-sms/index.ts` | honor `x-dry-run` in addition to body; wrapper with existing `logId`; dry-run writes unified rows, still skips claim RPC |
| `send-mass-sms/index.ts` | keep `user_id` on recipient list; persist unified rows after `mass_sms_log` insert (have `run_id`); dry-run count preview still does not write (no message body) |
| `tests/unit/sms-message-log.test.ts` | builder: index-matching results, DRY_RUN status, price parse, run_id passthrough |
| Docs | `docs/SMS_ESCALATION.md`, `docs/PAYROLL_SMS_REMINDER.md`, `docs/cron-jobs-inventory.md` — operator-visible logging note only |

### Proof of no behavior change

Dry-run before/after on each function: compare `eligible_count` / overdue length / `countWithPhone` and sample bodies. Local invocation of remote functions is possible only with `SUPABASE_SERVICE_ROLE_KEY` (see `scripts/test-payroll-sms-reminder.sh`). If that key is present, run dry-run and record counts in `02-CHUNK1-VERIFICATION.md`. If not, state that local dry-run against prod was not run.

Code-level proof: `sendSMS()` body/URL/auth unchanged; wrapper only adds a DB insert after the existing POST (or instead of it when `isDryRun`). Recipient queries and message builders are not edited except reminder’s new dryRun short-circuit (cron still sends).

### Rollback

1. Do not apply the migration to remote (this session will not).
2. If applied: stop writing by redeploying the four functions from `main`; table and view can remain (additive). No DROP of legacy tables.
3. `DELETE FROM sms_message_log;` is safe; it is not referenced by crons.

## Chunks 2-7 outline

**Chunk 2 — Export.** Add an “SMS Communications” `SectionConfig` in `ComplianceDataExportPanel.tsx` reading `sms_message_log_compat` (or live table + view) with date range on `sent_at`, `is_dry_run = false`, columns for name/role (join `app_users`), message type, timestamp, status, opt-out snapshot, consent placeholder. CSV + PDF via existing `DataExporter`; `logReportExported`. Mask phone in the panel preview; full E.164 in CSV only if product agrees. Playwright: admin opens panel, section exists, Load with a date range does not 500.

**Chunk 3 — Inbound opt-out.** `clicksend-inbound-webhook` (`x-internal-key` or ClickSend token, GET probe like `notify-admins-new-signup`), parse STOP/START/HELP, write `sms_opt_out_events`, set flags (policy TBD). Nightly recon function GET ClickSend opt-out list, dry-run diff first, kill switch. Do not change send filters until recon is trusted.

**Chunk 4 — Sender registry.** `sms_sender_numbers` (E.164, purpose, 10DLC status, last verified). Every function reads `from` from it (fallback remains current env default until rows exist). Fix mass empty-`from`. Admin-only UI can wait; a seed row for `+18443781444` is enough.

**Chunk 5 — Consent.** `sms_consent_records` + onboarding checkbox in `useAuthForm.ts` (not Home.tsx) and a profile control. Operational vs announcement categories. Timestamped. Do not silently backfill.

**Chunk 6 — Cert-expiry SMS.** Mirror `cert-expiry-reminders` 30/14/7 buckets via `sendAndLogSMS`, GSM-7 ≤160, dry-run + `app_settings` kill switch + idempotency keyed by (user, cert, bucket, date). Honor `sms_operational_opt_out`. Exclude `@atts.test`.

**Chunk 7 — Heat-index SMS.** Port `heatIndexF` to `_shared/heatIndex.ts`. Cron or dispatch when NOAA/OSHA caution/warning/danger crossed for crews scheduled that day. Same dry-run / kill switch / logging / opt-out / test-account rules. Cost-approval checklist like payroll.

## Open questions for Braden

1. Confirm with ClickSend (dashboard or support): which sending numbers are active, what each is for, and current A2P 10DLC brand/campaign status. Paste `CLICKSEND_USERNAME` + API key into repo `.env` and `~/.cursor/mcp.json` (toggle **send-sms off**) so the next session can finish account facts.
2. Stay on ClickSend (add inbound webhook) or timebox a ClickSend-vs-Twilio look this week?
3. HR/legal: consent language and cadence (annual re-confirm?) for the onboarding checkbox.
4. Retention: SOP draft is 5 years for opt-out/consent-export records, 2 years for routine send logs — confirm or override.
5. Should DOT medical / CDL expiry join the cert-expiry SMS category?
6. STOP policy: set **both** `sms_operational_opt_out` and `sms_marketing_opt_out`, or marketing-only (operational safety texts keep going)?
7. Mass SMS currently includes `@atts.test` accounts and does not set `from`. Leave as-is until Chunk 4, or treat test-account exclusion as a drive-by? (Chunk 1 will not change it.)

## Blockers

(none — Chunk 1 does not require ClickSend read access or a live DB apply.)
