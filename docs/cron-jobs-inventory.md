# Cron Jobs Inventory & Verification

All cron jobs that call Edge Functions require a valid **service role** key. Migrations create jobs with `SERVICE_ROLE_KEY_PLACEHOLDER`; you must either run **deploy-cron-auth.sh** (injects the key into every job) or, for **safety-announcement-5am** only, add **CRON_SERVICE_ROLE_KEY** to Supabase Vault.

## HTTP cron jobs (require auth)

| Job name | Schedule (UTC) | When (Central) | Edge Function |
|----------|-----------------|----------------|---------------|
| safety-announcement-5am | 0 10 * * 1-5 | Mon–Fri 5:00 AM | generate-safety-announcement |
| safety-briefing-reminder-push | 20 10 * * 1-5 | Mon–Fri 5:20 AM | safety-briefing-reminder-push |
| safety-briefing-reminder-sms | 40 10 * * 1-5 | Mon–Fri 5:40 AM | safety-briefing-reminder-sms |
| weekly-attendance-summary | 0 12 * * 1 | Monday 7:00 AM | weekly-attendance-summary |
| admin-safety-forecast | 30 12 * * 1-5 | Mon–Fri 6:30 AM | admin-safety-forecast-cron |
| admin-compliance-9am | 0 15 * * 1-5 | Mon–Fri 9:00 AM | admin-compliance-cron |
| safety-briefing-escalation-sms | 0 16 * * 1-5 | Mon–Fri 10:00 AM | safety-briefing-escalation-sms |
| weekly-safety-audit-report | 0 23 * * 5 | Friday 5:00 PM | weekly-safety-audit-report |
| auto-tune-risk-algorithm | 0 2 * * 0 | Sunday 2:00 AM | auto-tune-risk-algorithm |
| check-algorithm-performance | 0 3 * * * | Daily 3:00 AM | check-algorithm-performance |
| monthly-compliance-summary | 0 14 1 * * | 1st of month 8:00 AM | monthly-compliance-summary |

## Other cron jobs (no HTTP auth)

- **update-expired-certs** – runs `update_expired_certifications()` (no Edge Function).
- **run-data-retention** – runs `run_data_retention()` (no Edge Function).
- **refresh-compliance-summary-90d** – refreshes materialized view (no Edge Function).
- **refresh-cert-analytics** – refreshes cert analytics views (no Edge Function).
- **monthly-safety-drawing** – uses `x-drawing-secret` and `app.settings.drawing_secret` (different auth).

## Making sure all HTTP jobs work

1. **Option A (recommended):** Run the deploy script once (or after key rotation):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY="..." SUPABASE_DB_URL="..." ./scripts/deploy-cron-auth.sh
   ```
   This updates all 11 HTTP jobs with the real key.

2. **Option B (5 AM announcement only):** Use Vault: add secret **CRON_SERVICE_ROLE_KEY** in Dashboard → Vault. Migration `20260319120005` makes `safety-announcement-5am` call `run_safety_announcement_5am()`, which reads that secret. Other jobs still need Option A unless you add more Vault-based wrappers.

## Verification

- **List scheduled jobs:** In SQL Editor or psql:
  ```sql
  SELECT jobname, schedule, active FROM cron.job
  WHERE jobname IN (
    'safety-announcement-5am', 'admin-compliance-9am', 'admin-safety-forecast',
    'auto-tune-risk-algorithm', 'check-algorithm-performance',
    'safety-briefing-reminder-push', 'safety-briefing-reminder-sms',
    'safety-briefing-escalation-sms', 'monthly-compliance-summary',
    'weekly-attendance-summary', 'weekly-safety-audit-report'
  )
  ORDER BY jobname;
  ```
- **Recent runs (and failures):**
  ```sql
  SELECT * FROM public.cron_job_runs ORDER BY start_time DESC LIMIT 20;
  SELECT * FROM public.get_recent_cron_failures(7);
  ```

If runs show HTTP 401 or “Unauthorized”, (re)run `deploy-cron-auth.sh` or fix the Vault secret for the 5 AM job.
