# SMS Safety Briefing Escalation – Setup Guide

This system sends SMS for the **daily safety briefing** (no reward-claim check):

- **Tier 0 (reminder):** Same-day morning nudge to employees who haven’t completed today’s briefing. Message: *ATTS Safety: Good morning {firstName} — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.* (First name from `app_users.full_name`; omitted if missing.) Cron **Monday–Friday at 13:00 UTC** (7:00 AM CST / 8:00 AM CDT). Suppressed by company calendar, user absences, and new hires (&lt; 5 calendar days).
- **Tier 1:** 1 business day overdue → SMS to the employee’s **direct supervisor** (from `app_users.manager_id`). *As of the 10x upgrade, tier 1 is dynamic; the previous static tier-1 list was migrated to tier 2.*
- **Tier 2:** 2 business days overdue → SMS to static recipients in `sms_escalation_recipients` (tier = 2).

SMS is sent via **ClickSend**. Push uses `notification_events` → `notifications-dispatch` → `notifications-worker`. Escalation cron runs **Monday–Friday at 16:00 UTC** (10:00 AM CST / 11:00 AM CDT).

---

## Step 1: Apply database migrations

Run the migrations so the new tables and cron jobs exist.

**Option A – Supabase CLI (recommended):**

```bash
npx supabase db push
```

This applies all migrations in order, including: `sms_escalation_recipients`, `sms_escalation_send_log`, escalation cron, trim-phone trigger, tier 0 + tier migration, `company_calendar` / `user_absences`, and the reminder cron (`safety-briefing-reminder-sms`).

**Option B – Supabase Dashboard (manual):**

1. Open your project → **SQL Editor**.
2. Run the contents of these migration files **in order**:
   - `20260310000004_sms_escalation_recipients.sql`
   - `20260310000005_sms_escalation_send_log.sql`
   - `20260310000006_schedule_safety_escalation_sms_cron.sql`
   - `20260310000007_sms_escalation_recipients_trim_phone.sql`
   - `20260310120000_sms_escalation_tier0_and_tier_migration.sql`
   - `20260310120001_company_calendar_user_absences.sql`
   - `20260310120002_schedule_safety_briefing_reminder_sms_cron.sql`
   - `20260310130000_sms_escalation_orphaned_and_suppression_log.sql`
   - `20260310130001_sms_escalation_recipients_extract_e164.sql`
   - `20260310130002_sms_escalation_recipients_normalize_phone_formats.sql`
   - `20260310130003_normalize_app_users_phone_numbers.sql`

After this, both SMS cron jobs exist but use a placeholder auth key until you run the deploy script (Step 4).

**If you see “duplicate key value violates unique constraint schema_migrations_pkey”:**  
Another migration may share the same version number. Run `scripts/repair-sms-escalation-migrations.sql` in the SQL Editor if needed (it removes stale version rows for renamed migrations), then run `npx supabase db push` again. The migrations use `IF NOT EXISTS` / `CREATE OR REPLACE`, so re-running is safe.

---

## Quick path: send a test SMS

1. **Migrations:** `npx supabase db push`
2. **Recipients:** Add at least one tier-2 recipient (Step 5 below) so escalation can send; for tier-0 reminder, ensure an active field user has `app_users.phone_number` set and no briefing for today.
3. **Secrets:** In Supabase → Project Settings → Edge Functions → Secrets, set `CLICKSEND_USERNAME`, `CLICKSEND_PASSWORD`, and (optional) `CLICKSEND_FROM_NUMBER`.
4. **Deploy functions:**  
   `npx supabase functions deploy safety-briefing-reminder-sms`  
   `npx supabase functions deploy safety-briefing-escalation-sms`
5. **Cron auth:** `SUPABASE_SERVICE_ROLE_KEY=xxx SUPABASE_DB_URL=xxx ./scripts/deploy-cron-auth.sh`
6. **Test (no SMS if no overdue):**  
   `curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/safety-briefing-reminder-sms' -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'`  
   Or call the escalation URL the same way. Check `sms_escalation_send_log` after a run.

---

## Step 2: Get ClickSend credentials

1. Sign up or log in at [clicksend.com](https://www.clicksend.com).
2. Go to **Dashboard → API Credentials** (or top-right **API Credentials**).
3. Copy your **API Username** and **API Key** (this is the “password” for Basic auth).
4. (Optional) Add credits and configure a sender ID if required for your region.  
   **Note:** Do not put URLs in SMS body unless your account is approved for URL messaging.

---

## Step 3: Set Edge Function secrets in Supabase

The function needs your ClickSend credentials and (optionally) an internal secret.

1. In Supabase: **Project Settings → Edge Functions → Secrets** (or **Settings → API** and manage secrets as per your project).
2. Add or update:

   | Secret name            | Value              | Required for SMS |
   |------------------------|--------------------|------------------|
   | `CLICKSEND_USERNAME`   | Your API username  | Yes              |
   | `CLICKSEND_PASSWORD`   | Your API key       | Yes              |
   | `CLICKSEND_FROM_NUMBER`| E.164 sender (e.g. `+18443781444`) | No (defaults to +18443781444) |
   | `INTERNAL_SECRET`     | Any long random string (for manual `x-internal-key` calls) | No (cron uses Bearer) |

3. Save. Redeploy or ensure the function is deployed so it picks up the new secrets.

---

## Step 4: Deploy the Edge Function and cron auth

1. Deploy the Edge Functions (if not already deployed):

   ```bash
   npx supabase functions deploy safety-briefing-reminder-sms
   npx supabase functions deploy safety-briefing-escalation-sms
   ```

2. Wire the cron job to use your **service role key** by running the deploy script:

   ```bash
   # From project root. Uses .env for SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL
   ./scripts/deploy-cron-auth.sh
   ```

   When prompted, enter your **Supabase service role key** (and DB URL if needed).  
   This updates **all** cron jobs (including `safety-briefing-escalation-sms`) to use the Bearer token. No need to set `x-internal-key` in the cron; the function accepts the service role Bearer.

---

## Step 5: Add SMS escalation recipients

**Tier 0** sends to employees' own phones (`app_users.phone_number`); no rows needed for tier 0. **Tier 1** is dynamic (supervisor via `app_users.manager_id`). **Tier 2** uses the static list below.

1. In Supabase: **Table Editor → `sms_escalation_recipients`** (or run SQL below).
2. Insert tier **2** rows with **E.164** phone numbers (e.g. `+15551234567`).

**Example SQL:**

```sql
-- Tier 2 only (tier 0 = employee phones; tier 1 = supervisor via manager_id)
INSERT INTO public.sms_escalation_recipients (tier, phone_e164, label, sort_order)
VALUES
  (2, '+15551234567', 'Safety Lead', 1),
  (2, '+15559876543', 'Ops Manager', 2),
  (2, '+15551112222', 'Admin', 3);
```

- **tier:** Use `2` for escalation (tier 1 = supervisor via `manager_id`).  
- **phone_e164:** E.164 only (e.g. `+1` for US).  
- **label:** Optional (e.g. “Safety Lead”).  
- **sort_order:** Order within tier (lower = first).  
- **is_active:** Default `true`; set to `false` to pause someone (e.g. vacation) without deleting.

---

## Step 6: Verify

1. **Cron job**  
   In Supabase **SQL Editor**:

   ```sql
   SELECT jobname, schedule, active
   FROM cron.job
   WHERE jobname IN ('safety-briefing-reminder-sms', 'safety-briefing-escalation-sms');
   ```

   You should see: `safety-briefing-reminder-sms` at `0 13 * * 1-5` (7 AM CST), `safety-briefing-escalation-sms` at `0 16 * * 1-5` (10 AM CST).

2. **Manual test (no SMS)**  
   Reminder (tier 0):

   ```bash
   curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/safety-briefing-reminder-sms' \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
   ```

   Escalation (tiers 1 & 2):

   ```bash
   curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/safety-briefing-escalation-sms' \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
   ```

   **Dry-run (no SMS, no send_log):** Run with `-d '{"dryRun":true}'` or `-H "x-dry-run: true"` to compute D1/D2, overdue lists, and suppression without sending. Response includes `suppressionLog.tier1` and `suppressionLog.tier2` (overdue_before, overdue_after, users_excluded_absences, dates_skipped_calendar) and a `verificationHint`. Use this with a known company_calendar date and user_absence row to confirm overdue_before − overdue_after equals excluded absences and that skipped dates appear in dates_skipped_calendar before enabling real sends.

   Replace `YOUR_PROJECT_REF` and `YOUR_SERVICE_ROLE_KEY`. Reminder returns `sent`/`skipped`/`reason`; escalation returns `tier1` and `tier2` (e.g. `overdueCount`, `sent`, `skippedReason`).

3. **Send log**  
   After a run (or test), check:

   ```sql
   SELECT * FROM public.sms_escalation_send_log ORDER BY sent_at DESC LIMIT 5;
   ```

   You’ll see `total_price` and `results` (per-recipient status) when a send was attempted.

---

## Summary checklist

| Step | Action |
|------|--------|
| 1 | Run migrations (`db push` or run the 3 SQL files in order). |
| 2 | Get ClickSend API username and API key from clicksend.com. |
| 3 | In Supabase, set secrets: `CLICKSEND_USERNAME`, `CLICKSEND_PASSWORD`. |
| 4 | Deploy the function and run `./scripts/deploy-cron-auth.sh` to set cron auth. |
| 5 | Insert tier 2 rows into `sms_escalation_recipients` (E.164 phones). Tier 1 is dynamic (per-manager); ensure `app_users.manager_id` and manager phone numbers are populated. |
| 6 | Confirm cron row and optional manual curl; check `sms_escalation_send_log` after a run. |

---

## Behavior summary

- **Safety briefings are day-specific (no backfill):** One briefing per weekday; users can complete only that day’s briefing on that day. There is no “going back” to complete a missed day. This is intentional so employees cannot wait until Friday to review all briefings—safety is the first priority. Escalation messages never imply that past briefings can be “made up.”
- **Tier 0 (reminder):** Weekdays only. Proactive morning nudge (personalized with first name when available): *ATTS Safety: Good morning {firstName} — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.* Skips if weekend, if `company_calendar` has an entry for today, or if there is no announcement for today. Excludes users in `user_absences` for today and new hires (created &lt; 5 calendar days ago). Sends one SMS per overdue employee with a phone number. Idempotent: one send per day for tier 0.
- **Overdue (tiers 1 & 2):** Active field users (employee, foreman, general_foreman, mechanic) with **no** `safety_briefing_answers` row matching the target date's `briefing_date` **or** `announcement_id`. This cross-reference catches late completions where a user completed the correct announcement but the `briefing_date` was recorded as the next calendar day (e.g. completed after midnight). New hires (created &lt; 5 calendar days ago) are excluded from escalation, matching tier 0 behavior. Reward-claim status is not used.
- **Tier 1 (escalation):** Dynamic per-manager: one SMS per manager (from `app_users.manager_id`) listing that manager's overdue direct reports for D1 with compliance ratio ("3 of 8 crew members"). Users with no manager or manager with no phone are **routed to tier 2** and logged in `sms_escalation_send_log.orphaned_user_ids` with reason `"no manager"` or `"no manager phone"`.
- **Tier 2 (escalation):** Static recipients from `sms_escalation_recipients` (tier = 2 only). The **D2 (older date) list** is split into two groups: (1) **Current on most recent day** — missed D2 but completed D1 (e.g. “X missed Mar 2 but completed Mar 3: [names]”); (2) **Also missed** — missed D2 and D1 (e.g. “Also missed Mar 2: [names]”). When *both* groups exist, the message shows **count only** for the first group and the **name list for still-behind** to stay within SMS length and prioritize who needs follow-up. When *everyone* in the D2 list completed D1, names are shown for that line; when both groups exist, caught-up is count-only—so the format can differ week to week (document this so admins aren’t confused). D1 orphans (no supervisor) are appended in a separate line: “Missed (D1 date) (no supervisor): K employees…”. One send per (tier, date_checked) per day. **Note:** SMS copy uses "missed" (past tense) rather than "overdue" because briefings are day-specific with no backfill — "overdue" implies an outstanding obligation that can still be fulfilled, which is not the case.
- **Business days:** D1 and D2 are **calendar-aware**: walk backward from today skipping weekends and any date in `company_calendar`. **Max lookback:** if D1 or D2 is more than 5 calendar days ago, that tier is skipped (confirm with stakeholders for full-week shutdowns). Defensive check: do not escalate for a date that is in `company_calendar` even if an announcement exists.
- **user_absences:** **Enter by end of the previous business day** to be respected by escalation; no cron delay or re-check. **Timezone:** `user_absences.date` is compared as the same canonical calendar date as D1/D2 (both computed in America/Chicago) — document and assume all absence entry uses that same date frame to avoid off-by-one. **Product:** Surface this deadline in the app UI where absences are entered (e.g. hint: "Enter by end of previous business day to affect that day's escalation") so managers see it; currently it is only in this doc.
- **Suppression:** `company_calendar` and `user_absences` exclude users/dates from escalation. Each send logs `suppression_log` JSONB with: `dates_skipped_calendar`, `users_excluded_absences`, `overdue_before`, `overdue_after`, `D1`/`D2`, `announcement_id`, `completed_set_size`, `field_users_count`, `completions_matched_by_announcement_id_only`, and for Tier 2 `d2_caught_up_count` and `d2_still_behind_count` (D2-overdue who completed D1 vs still behind).
- **STOP opt-out:** All escalation SMS include "Reply STOP to opt out." ClickSend handles STOP at the carrier level automatically — no application-side webhook needed.
- **Idempotency:** One send per (tier, date_checked) per calendar day (Chicago); duplicate cron runs do not double-send.
- **Weekly reset:** Escalation resets every Monday. D1/D2 dates from the previous week are automatically skipped (`skippedReason: "Week reset (D1/D2 before this Monday)"`). This prevents stale carry-over from the prior week. **Trade-off:** Friday non-compliance only receives a Tier 0 reminder (7 AM) with no Tier 1 or Tier 2 escalation, since Monday's D1 = Friday which is before that Monday's reset boundary when `D1 < weekMonday` is `false` (Friday equals weekMonday minus 3, so it IS before Monday and IS skipped). This means Friday compliance relies on the Tier 0 reminder alone. If this is unacceptable, a same-day Friday escalation (e.g. 3 PM Friday) can be added later.
- **Test user exclusion:** All `app_users` queries in notification/compliance functions exclude rows where `email ILIKE '%@atts.test'`. This prevents E2E test accounts from appearing in SMS, push, email, and compliance reports. The filter uses `NOT ILIKE` with a leading wildcard (sequential scan); acceptable at current scale (~25 users) but should migrate to a boolean `is_test_account` column if the user table grows to thousands. Applied to: `safety-briefing-escalation-sms`, `safety-briefing-reminder-sms`, `safety-briefing-reminder-push`, `cert-expiry-reminders`, `monthly-compliance-summary`, `admin-compliance-cron`, `check-compliance-9am`, `notifications-dispatch`, `weekly-safety-audit-report`.
- **Cost:** Each run logs `total_price` in `sms_escalation_send_log` for visibility without the ClickSend dashboard.
- **Manager assignment (temporary):** As of 2026-03-04, all active field workers are assigned `manager_id` = Steve Curtis (general foreman). This is a stopgap so Tier 1 works immediately. **Follow-up required:** enforce `manager_id` assignment in the employee creation/activation flow (admin UI or onboarding) so new hires don't default to null and silently fall back to orphan routing. Once the company restructures into distinct crews, update `manager_id` values to reflect real reporting relationships.

**Recommended next step (observability):** Verbose console logging helps for the first week, but a **Slack (or dashboard) health check on each cron run** — e.g. "escalation ran, N dates, M messages, 0 errors" or alert on missed run — turns this from "we'll check the logs" into "we'll know immediately." Other roadmap items: batching (one message per recipient per run with segment cap), delivery confirmation (ClickSend status callbacks).

**Post-deployment validation:** After deploying the `announcement_id` cross-reference fix, run with `dryRun: true` and check `completions_matched_by_announcement_id_only` in the response. To preview the impact against historical data:

```sql
-- Shows completions where briefing_date differs from the announcement's date
-- (rows the old query missed but the new cross-reference catches)
SELECT sba.user_id, sba.briefing_date, sba.announcement_id, a.date AS announcement_date
FROM safety_briefing_answers sba
JOIN announcements a ON a.id = sba.announcement_id
WHERE a.date != sba.briefing_date
  AND a.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY a.date DESC;
```

---

## Monthly Executive Summary

A separate **monthly compliance report** is emailed to a configurable list of executives on the **1st of every month at 8:00 AM CST** (14:00 UTC). It is intended for the safety director to print and bring to the monthly safety committee meeting.

- **Schedule:** 1st of every month, 8:00 AM CST (pg_cron: `0 14 1 * *`).
- **Recipients:** Configurable via the `monthly_summary_recipients` table (admin-only RLS). Only add authorized HR leadership, safety directors, and executive management — **Section 4 (Repeat Offenders)** contains individual employee names and miss counts (PII).
- **Content (6 sections):** SMS volume and cost (with prior-month comparison), overall compliance rate and trend, crew-level compliance ranking, repeat offenders (3+ unexcused misses), safety incidents summary, and data quality (users/managers missing phone or manager).
- **Manual re-run:** To regenerate a specific month (e.g. after a fix or for backfill):
  ```bash
  curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/monthly-compliance-summary?month=2026-03' \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
  ```
- **Dry run (preview without sending):** Returns the full report (subject, HTML, text, metrics) in the JSON response without sending email or writing to the send log:
  ```bash
  curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/monthly-compliance-summary?dry_run=true' \
    -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
  ```
- **Tables:** `monthly_summary_recipients` (who receives the email), `monthly_summary_send_log` (audit and idempotency; stores `report_html` even on failure for optional retry reuse).
- **Idempotency:** A unique index on `monthly_summary_send_log(month_label) WHERE success = true` prevents duplicate sends for the same month; a second run returns `{ status: "already_sent" }`.

### Recipient management (direct SQL)

There is no admin UI yet (Phase 2). Use Supabase Dashboard → SQL Editor or `psql`:

```sql
-- Add a recipient
INSERT INTO monthly_summary_recipients (email, name)
VALUES ('shane@alltts.com', 'Shane');

-- Deactivate a recipient (soft delete)
UPDATE monthly_summary_recipients SET active = false WHERE email = 'old@alltts.com';

-- List active recipients
SELECT email, name FROM monthly_summary_recipients WHERE active = true;
```

### Deploying the monthly summary

1. Apply the migration that creates `monthly_summary_recipients`, `monthly_summary_send_log`, and the cron entry: `20260311000000_monthly_compliance_summary.sql` (included in `npx supabase db push`).
2. Deploy the Edge Function: `npx supabase functions deploy monthly-compliance-summary`
3. Set Edge Function secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD` (same as admin-compliance-cron).
4. Run `./scripts/deploy-cron-auth.sh` so the monthly job uses the service role key (the script includes `monthly-compliance-summary`).
5. Insert at least one row into `monthly_summary_recipients`; otherwise the function skips send and returns `{ status: "skipped", reason: "no_recipients" }`.

### Future enhancements (v2)

- **Supervisor Response section:** Track how many employees completed after Tier 1 supervisor notification vs escalated to Tier 2. Deferred from v1 because the current data model does not reliably support cross-referencing tier outcomes per employee.
- **PDF attachment:** Printable version for the safety committee binder.
- **Admin UI:** Manage recipients from the portal instead of direct SQL.
