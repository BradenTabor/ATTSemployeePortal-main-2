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
| payroll-hours-reminder-sms-utc14 | 0 14 * * 4,5,6 | Thu–Sat 8:00 AM CST | payroll-hours-reminder-sms |
| payroll-hours-reminder-sms-utc13 | 0 13 * * 4,5,6 | Thu–Sat 8:00 AM CDT | payroll-hours-reminder-sms |

**Payroll SMS DST:** Both UTC jobs run year-round; only the invocation at true 8:00 AM America/Chicago sends (wall-clock guard in the Edge Function). See [PAYROLL_SMS_REMINDER.md](./PAYROLL_SMS_REMINDER.md). Per-recipient audit rows live in `sms_message_log` once Chunk 1 is applied (legacy per-run tables are unchanged).

## Other cron jobs (no HTTP service-role Bearer)

- **update-expired-certs** – runs `update_expired_certifications()` (no Edge Function).
- **run-data-retention** – runs `run_data_retention()` (no Edge Function).
- **refresh-compliance-summary-90d** – refreshes materialized view (no Edge Function).
- **refresh-cert-analytics** – refreshes cert analytics views (no Edge Function).
- **monthly-safety-drawing** – **intentional auth exception:** uses header `x-drawing-secret` from `app.settings.drawing_secret`, **not** a Bearer service-role token. Do not “fix” this job by injecting `Authorization: Bearer …` via `deploy-cron-auth.sh`; leave the drawing-secret header as-is.
- **cron-http-failure-sweep** – runs `sweep_cron_http_failures()` every 2 hours at `:07`. Pure SQL, no Edge Function, so it keeps working even when the thing it monitors (service-role Bearer auth) is broken. See below.

## Monitoring (HTTP non-2xx)

`cron.job_run_details.status` is `succeeded` whenever `net.http_post` queues successfully — even if the Edge Function returns 401. Migration `20260909173000_cron_failures_detect_http_non_2xx` taught `public.get_recent_cron_failures(days)` and `public.cron_job_runs.effective_status` to also read `net._http_response`, which is where the real status code lands.

### Why detection alone was not enough

`pg_net.ttl` ≈ **6 hours**. A detector limited to a 6-hour window cannot feed a weekly or monthly report — the evidence expires before anyone reads it.

Migration `20260909180000_cron_http_failures_durable` closes that:

| Object | Purpose |
|---|---|
| `public.cron_http_failures` | Durable row per non-2xx / timed-out cron HTTP response: `jobname`, `function_name`, `status_code`, `response_excerpt`, `occurred_at`. RLS admin-SELECT, same shape as the other log tables. |
| `public.sweep_cron_http_failures(lookback_hours default 8)` | Copies non-2xx rows out of `net._http_response` before the TTL discards them. Idempotent via unique `(response_id, occurred_at)`; the 8-hour lookback exceeds the 6-hour TTL so a skipped sweep cannot open a gap. |
| `cron-http-failure-sweep` | pg_cron job, `7 */2 * * *`. Two-hour interval against a six-hour window leaves two missed sweeps of headroom. |

`get_recent_cron_failures(days)` now reads the durable table first and unions the not-yet-swept tail still sitting in `net._http_response`, deduped by response id. It answers for weeks instead of hours.

`cron-http-failure-sweep` is itself in the monitored job list — a silently broken sweep would re-blind the monitor, which is the exact failure this work exists to close.

### History limit — read this before asking for a trend

**Cron failure history before 2026-09-09 is unrecoverable.** Nothing was backfilled and nothing can be: `net._http_response` had already discarded it, and `cron.job_run_details` recorded those runs as `succeeded` because queuing the request did succeed. The durable table starts empty on 2026-09-09 and grows forward only. Any statement about how long the `safety-briefing-reminder-push` 401s had been running before that date is a guess, not a measurement.

### Alert proposal (not built)

The durable table makes the monthly compliance email useful as a **summary**, but monthly is too slow for a job like `safety-briefing-reminder-sms`. Smallest same-week signal, using something already in the app: add a **“Cron health (last 7 days)”** section to `weekly-safety-audit-report` (Fri 5 PM CST, already emailed to leadership via `email_recipient_lists.list_key = 'weekly_safety_audit'`, already built from composable HTML sections) that calls `get_recent_cron_failures(7)` and lists failing `jobname` + count + last timestamp. It must print an explicit **“0 cron failures this week”** line when clean, so a missing report is distinguishable from a healthy one — that matters because the report is itself an HTTP cron job and can fail the same way. If Friday latency proves too slow, the escalation is to have the 2-hour SQL sweep insert a `notification_events` row (`category='admin_notice'`, `severity='high'`, `target_type='role'`, `target_ref='admin'`, deduped to one per job per day); that is the only path whose detection step does not depend on the Edge Function auth most likely to be broken.

### Queries

```sql
-- Durable history (weeks)
SELECT jobname, status_code, count(*), min(occurred_at), max(occurred_at)
FROM public.cron_http_failures
WHERE occurred_at > now() - interval '30 days'
GROUP BY 1, 2 ORDER BY 3 DESC;

-- Force a sweep now (safe, idempotent)
SELECT public.sweep_cron_http_failures();
```

## Making sure all HTTP jobs work

1. **Option A (recommended):** Run the deploy script once (or after key rotation):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY="..." SUPABASE_DB_URL="..." ./scripts/deploy-cron-auth.sh
   ```
   This updates all 13 HTTP jobs with the real key.

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
    'weekly-attendance-summary', 'weekly-safety-audit-report',
    'payroll-hours-reminder-sms-utc14', 'payroll-hours-reminder-sms-utc13'
  )
  ORDER BY jobname;
  ```
- **Recent runs (and failures):**
  ```sql
  SELECT * FROM public.cron_job_runs ORDER BY start_time DESC LIMIT 20;
  SELECT * FROM public.get_recent_cron_failures(7);
  ```

If runs show HTTP 401 or “Unauthorized”, (re)run `deploy-cron-auth.sh` or fix the Vault secret for the 5 AM job.
