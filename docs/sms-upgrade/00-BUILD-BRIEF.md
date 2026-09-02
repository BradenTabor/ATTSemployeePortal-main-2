# SMS Pipeline Upgrade — Build Brief (agent-facing)

> Audience: the Cursor agent working in this repo. This is the technical companion to the
> approved planning documents in this folder (`10-`, `11-`, `12-`). Those documents are the
> **why** and the **what**; this file is the **where** — concrete file paths, tables, and
> constraints, verified by reading the code as of 2026-09-02. Treat anything marked
> *HYPOTHESIS* as something to verify, not as fact.

## Ground rules for every session in this project

1. **Recipients are employees/crew only.** Never add a customer-facing send path.
2. **Never send a live SMS from a dev/agent session.** Every function already has a `dryRun`
   pattern (`{"dryRun": true}` body or `x-dry-run: true` header). New functions must have one too.
   Treat `CLICKSEND_USERNAME` / `CLICKSEND_PASSWORD` as unavailable to you.
3. **Additive only.** New tables/columns/views/functions are fine. Do not drop, rename, or
   destructively alter `sms_escalation_send_log`, `mass_sms_log`, `payroll_reminder_sms_log`,
   or any `app_users` column. No `DROP`, no `ALTER ... TYPE`, no data rewrites without a
   migration that is explicitly reviewed first.
4. **Do not change safety-briefing business logic** (who is overdue, tiering, timing,
   escalation rules, suppression via `company_calendar` / `user_absences`). Only how sends
   are logged and how opt-outs are honored.
5. **Follow the repo's own skills before writing code:** `.cursor/skills/project-conventions`,
   `.cursor/skills/create-edge-function`, `.cursor/skills/create-supabase-migration`,
   `.cursor/skills/scaffold-admin-page` (esp. `references/export-pattern.md`),
   `.cursor/skills/add-e2e-test`.
6. **Hard gates after every change:** `npm run lint`, `npm run typecheck`, `npm run build`.
7. **Preserve the existing idempotency + kill-switch patterns** (`app_settings` flag like
   `payroll_reminder_sms_config.enabled`; one send per (tier, date) slot; crash-safe claim RPC).
8. **Exclude test accounts** everywhere: `email NOT ILIKE '%@atts.test%'` (existing convention).
9. Migrations: newest existing prefix is `20260627170000_…`. New migrations must sort after it
   (use `202609DDHHMM00_…`).

## Where things live today

### Sending
| What | Path | Notes |
|---|---|---|
| Shared ClickSend helper | `supabase/functions/_shared/clicksend.ts` | `sendSMS(messages, {username,password,from})` → POST `https://rest.clicksend.com/v3/sms/send`; returns per-message `status`, `messageId`, `price`; treats `SUCCESS` and `THROTTLED` as success. **This is the single choke point** for unified logging. |
| Safety briefing reminder (Tier 0) | `supabase/functions/safety-briefing-reminder-sms/index.ts` | Mon–Fri 10:40 UTC. Default from `+18443781444`. |
| Safety briefing escalation (Tier 1/2) | `supabase/functions/safety-briefing-escalation-sms/index.ts` | Mon–Fri 16:00 UTC. Four `sendSMS(` call sites (~L525, L582, L836, L894). Default from `+18443781444`. |
| Payroll hours reminder | `supabase/functions/payroll-hours-reminder-sms/index.ts` | Thu/Fri/Sat 8 AM Central, two UTC cron slots + wall-clock guard. Default from `+18443781444`. Kill switch `app_settings.payroll_reminder_sms_config`. |
| Admin mass SMS | `supabase/functions/send-mass-sms/index.ts` | Admin JWT; dry-run by default; 15-min cooldown; batches of 500. **Default `from` is `""` (unset)**, unlike the other three. |
| Cron inventory | `docs/cron-jobs-inventory.md`, `scripts/deploy-cron-auth.sh` | All HTTP cron jobs need the service-role Bearer injected. |

> *HYPOTHESIS (verify):* the "two different numbers" seen in production may be (a) the
> dedicated `+18443781444` used by the three scheduled functions and (b) whatever ClickSend
> picks when `send-mass-sms` runs with `CLICKSEND_FROM_NUMBER` unset. Confirm by checking the
> `from`/`fromNumber` recorded in `mass_sms_log.batch_details` vs `sms_escalation_send_log.results`,
> and by asking the account owner what the Supabase secret is set to per environment.

### Logging (fragmented — this is what gets unified)
| Table | Created by | Shape |
|---|---|---|
| `sms_escalation_send_log` | `20260310000005_…`, extended by `20260310130000_…` | One row per run per tier: `date_checked`, `tier`, `recipient_count`, `total_price`, `results` (jsonb per-recipient status), `orphaned_user_ids`, `suppression_log`. |
| `mass_sms_log` | `20260320120000_sms_opt_out_and_mass_sms_log.sql` | One row per blast: `admin_user_id`, `message_preview`, `sent_count`, `failed_count`, `total_price`, `status`, `batch_details`. **No per-recipient rows.** |
| `payroll_reminder_sms_log` | `20260521120000_payroll_hours_reminder_sms.sql` | One row per (date, tier) slot; RPC `claim_payroll_reminder_sms_log(date, tier)`. |
| `payroll_sms_cron_monitoring` | `20260521130000_…` | Cron run monitoring. |
| Schema snapshot | `supabase/.localgate/prod_schema.sql` | Use this to confirm exact current columns before writing SQL. |

None of these tables is exposed in the frontend (`grep` of `src/` for the table names returns nothing).

### Opt-out / consent state
| Field | Added by | Meaning |
|---|---|---|
| `app_users.sms_marketing_opt_out` | `20260320120000_…` | Excluded from admin mass SMS. |
| `app_users.sms_operational_opt_out` | `20260521120000_…` | Excluded from payroll (and should be honored by all operational sends — verify each function reads it). |
| `app_users.phone_number` | `20260308100000_…`; normalized `20260310130003_…`; **backfilled from `auth.users` by `20260320120001_backfill_app_users_phone_from_auth.sql`** | No consent record exists anywhere. |
| Escalation static recipients | `sms_escalation_recipients` (tier 2) | E.164, `is_active`. |

Known, self-documented gap: `docs/PAYROLL_SMS_REMINDER.md` § "Inbound STOP gap (v1)" — ClickSend blocks STOP'd numbers at the carrier, but nothing sets the app flags. There is **no inbound webhook function** in `supabase/functions/`.

Phone number is touched in UI at: `src/pages/Home.tsx`, `src/pages/TeamContacts.tsx`, `src/pages/admin/AdminRTO.tsx`.

### Export UI (the pattern to extend, not replace)
- `src/components/admin/ComplianceDataExportPanel.tsx` — sections with date range → Load → count → Export CSV/PDF. Uses `DataExporter`, `generateFilename`, `getExportColumns`, `formatDateForExport` from `src/lib/exportUtils`, and `logReportExported` from `src/lib/safetyAuditLog` (every export is itself audit-logged — keep that).
- Column examples: `src/pages/mechanic/equipment-logs/exportColumns.ts`.
- Skill reference: `.cursor/skills/scaffold-admin-page/references/export-pattern.md`.

### Existing pieces to reuse for the new message types
- Cert expiry: `supabase/functions/cert-expiry-reminders/index.ts` — 30/14/7-day buckets, per-worker push + admin digest via Gmail (`_shared/gmail.ts`). **No SMS today.**
- Heat index math: `src/components/safety/HeatIllnessAlert.tsx` → `heatIndexF(tempF, humidityPct)` with caution/warning/danger tiers. Frontend-only today; needs to be ported to a Deno function if used server-side.
- Push/event pipeline (for anything that should also go out as push): `notification_events` → `notifications-dispatch` → `notifications-worker` (`docs/NotificationEventDispatch.md`).
- Webhook-style DB→function examples: `docs/NotificationEventDispatch_webhook.sql`, `docs/AdminNewSignupNotification_webhook.sql`.
- Monthly exec summary to extend with SMS metrics: `supabase/functions/monthly-compliance-summary/index.ts`.

## Target architecture (from the PRD, mapped to this repo)

1. **Unified log** — new table `sms_message_log` (one row **per recipient per send**) written from inside `_shared/clicksend.ts` (or a thin wrapper every call site uses), with: `user_id` (nullable for static recipients), `phone_e164`, `message_type` (`safety_briefing_reminder` \| `safety_briefing_escalation_t1` \| `safety_briefing_escalation_t2` \| `payroll_reminder` \| `mass_sms` \| `cert_expiry` \| `heat_alert` \| …), `category` (`operational` \| `marketing`), `from_number`, `body` or `template_key`, `provider_message_id`, `provider_status`, `price`, `opt_out_state_at_send` (jsonb snapshot of both flags), `run_id` (FK-ish back to the legacy per-run log row), `sent_at`. RLS: admin select only; service-role insert. Plus a **backward-compat view** that unions/unnests the three legacy tables so history before cutover is queryable in the same shape.
2. **Inbound opt-out sync** — new Edge Function `clicksend-inbound-webhook` (internal-secret auth, `--no-verify-jwt`), parses STOP/START/HELP, updates `app_users.sms_operational_opt_out` / `sms_marketing_opt_out` (policy: STOP → both flags true unless product decides otherwise — flag this for the human), writes `sms_opt_out_events`. Plus a nightly reconciliation function that pulls ClickSend's opt-out list via API and diffs against `app_users`.
3. **Export** — new "SMS Communications" section in `ComplianceDataExportPanel.tsx` reading `sms_message_log` (+ compat view), CSV + PDF, audit-logged via `logReportExported`.
4. **Consent** — `sms_consent_records` table + onboarding/profile acknowledgment; categories operational vs announcement.
5. **Sender registry** — `sms_sender_numbers` config table (number, purpose, 10DLC status, last verified) and make **every** function read `from` from it instead of a hardcoded fallback.
6. **New message types** — `cert-expiry-reminder-sms`, `heat-index-alert-sms`, each with dry-run, kill switch, idempotency, and cost estimate before enable.

Suggested PR-sized chunks (each independently shippable, each behind a flag or dry-run):
- **Chunk 1** unified log table + view + logging inside `_shared/clicksend.ts` (no behavior change to sends).
- **Chunk 2** export section in `ComplianceDataExportPanel.tsx` + e2e test.
- **Chunk 3** inbound webhook + opt-out events + nightly reconciliation (dry-run diff first).
- **Chunk 4** sender registry + remove hardcoded `from` fallbacks.
- **Chunk 5** consent records + UI.
- **Chunk 6/7** cert-expiry SMS; heat-index SMS.
