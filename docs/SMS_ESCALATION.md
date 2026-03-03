# SMS Safety Briefing Escalation – Setup Guide

This system sends SMS for the **daily safety briefing** (no reward-claim check):

- **Tier 0 (reminder):** Same-day morning nudge to employees who haven’t completed today’s briefing. Message: *ATTS Safety: Good morning {firstName} — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.* (First name from `app_users.full_name`; omitted if missing.) Cron **Monday–Friday at 13:00 UTC** (7:00 AM CST / 8:00 AM CDT). Suppressed by company calendar, user absences, and new hires (&lt; 5 calendar days).
- **Tier 1:** 1 business day overdue → SMS to the employee’s **direct supervisor** (from `app_users.manager_id`). *As of the 10x upgrade, tier 1 is dynamic; the previous static tier-1 list was migrated to tier 2.*
- **Tier 2:** 2 business days overdue → SMS to static recipients in `sms_escalation_recipients` (tier = 2).

SMS is sent via **ClickSend**. Escalation cron runs **Monday–Friday at 16:00 UTC** (10:00 AM CST / 11:00 AM CDT).

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

After this, both SMS cron jobs exist but use a placeholder auth key until you run the deploy script (Step 4).

**If you see “duplicate key value violates unique constraint schema_migrations_pkey”:**  
Another migration may share the same version number. Run `scripts/repair-sms-escalation-migrations.sql` in the SQL Editor if needed (it removes version rows 20260310000004–006), then run `npx supabase db push` again. The migrations use `IF NOT EXISTS`, so re-running is safe.

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
| 5 | Insert tier 1 and tier 2 rows into `sms_escalation_recipients` (E.164 phones). |
| 6 | Confirm cron row and optional manual curl; check `sms_escalation_send_log` after a run. |

---

## Behavior summary

- **Tier 0 (reminder):** Weekdays only. Proactive morning nudge (personalized with first name when available): *ATTS Safety: Good morning {firstName} — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.* Skips if weekend, if `company_calendar` has an entry for today, or if there is no announcement for today. Excludes users in `user_absences` for today and new hires (created &lt; 5 calendar days ago). Sends one SMS per overdue employee with a phone number. Idempotent: one send per day for tier 0.
- **Overdue (tiers 1 & 2):** Active field users (employee, foreman, general_foreman, mechanic) with **no** `safety_briefing_answers` row for that date. Reward-claim status is not used.
- **Business days:** D1 = previous weekday; D2 = 2 weekdays ago (weekends skipped).
- **Suppression:** `company_calendar` (company-wide off) and `user_absences` (per-user PTO/sick/leave) suppress tier-0 reminders and can be used by escalation logic.
- **Idempotency:** One send per (tier, date_checked) per calendar day (Chicago); duplicate cron runs do not double-send.
- **Cost:** Each run logs `total_price` in `sms_escalation_send_log` for visibility without the ClickSend dashboard.
