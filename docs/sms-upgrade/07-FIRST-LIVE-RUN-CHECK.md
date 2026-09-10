# First live run check — post Chunks 1–3 deploy

**When:** After tomorrow’s crons (America/Chicago schedule):

| Cron | UTC | Purpose |
|------|-----|---------|
| `safety-briefing-reminder-sms` | **10:40** Mon–Fri | First live exercise of deployed `sendAndLogSMS` on reminder |
| `safety-briefing-escalation-sms` | **16:00** Mon–Fri | First live exercise of deployed escalation path |

Today’s 10:40 / 16:00 runs used **pre-deploy** function code (deploy was ~16:17 UTC after both had already sent).

---

## (i) Cron fired and returned HTTP 200

```sql
-- Preferred: pg_net responses around the cron minute
SELECT id, status_code, created, timed_out,
       left(coalesce(error_msg, ''), 120) AS err,
       left(coalesce(content::text, ''), 200) AS body
FROM net._http_response
WHERE created >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
  AND created <  date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '1 day'
ORDER BY created;

-- Monitored job failures (SMS jobs in the allow-list)
SELECT * FROM public.get_recent_cron_failures(2);

-- Optional: cron.job_run_details (HTTP jobs often leave thin/empty history;
-- treat net._http_response as source of truth for status codes)
SELECT j.jobname, d.status, d.start_time, left(coalesce(d.return_message, ''), 160) AS msg
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname IN (
  'safety-briefing-reminder-sms',
  'safety-briefing-escalation-sms'
)
AND d.start_time >= now() - interval '36 hours'
ORDER BY d.start_time DESC;
```

**Pass:** status_code **200** for reminder ~10:40 and escalation ~16:00; `get_recent_cron_failures` empty for those jobs.

---

## (ii) Unified log rows (`sms_message_log`, live)

```sql
-- Reminder (Tier 0)
SELECT count(*) AS n,
       count(*) FILTER (WHERE is_dry_run = false) AS live_n,
       count(*) FILTER (WHERE message_type = 'safety_briefing_reminder') AS type_ok,
       count(*) FILTER (WHERE category = 'operational') AS category_ok,
       min(sent_at) AS first_sent,
       max(sent_at) AS last_sent
FROM public.sms_message_log
WHERE sent_at::date = (now() AT TIME ZONE 'America/Chicago')::date
  AND message_type = 'safety_briefing_reminder';

-- Escalation tiers
SELECT message_type, category, is_dry_run, count(*) AS n
FROM public.sms_message_log
WHERE sent_at::date = (now() AT TIME ZONE 'America/Chicago')::date
  AND message_type IN (
    'safety_briefing_escalation_t1',
    'safety_briefing_escalation_t2'
  )
GROUP BY 1, 2, 3
ORDER BY 1;
```

**Pass:** `is_dry_run = false`, correct `message_type` / `category = operational`, non-zero counts matching overdue set.

---

## (iii) Legacy escalation log still written

```sql
SELECT date_checked, tier, overdue_count, recipient_count, total_price, created_at
FROM public.sms_escalation_send_log
WHERE date_checked = (now() AT TIME ZONE 'America/Chicago')::date
ORDER BY tier;
```

**Pass:** Today’s tier 1 / tier 2 rows exist with the same shape as pre-deploy (Chunk 1 is additive logging only).

Also confirm reminder idempotency row if the function still writes its legacy marker the same way as before (see function source / existing reminder log table if used).

---

## (iv) Recipient count matches pre-deploy expectation

Compare live counts to what pre-deploy would have produced:

```sql
-- Legacy escalation recipient_count / overdue_count for today
SELECT tier, overdue_count, recipient_count
FROM public.sms_escalation_send_log
WHERE date_checked = (now() AT TIME ZONE 'America/Chicago')::date
ORDER BY tier;

-- Unified live row counts should align with recipient_count per tier
SELECT message_type, count(*) AS unified_live
FROM public.sms_message_log
WHERE sent_at::date = (now() AT TIME ZONE 'America/Chicago')::date
  AND is_dry_run = false
  AND message_type IN (
    'safety_briefing_reminder',
    'safety_briefing_escalation_t1',
    'safety_briefing_escalation_t2'
  )
GROUP BY 1;
```

Optional dry-run cross-check (does **not** send if already sent today — may return `Already sent today`):

```bash
curl -sS -X POST \
  "$SUPABASE_URL/functions/v1/safety-briefing-reminder-sms" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "x-dry-run: true" \
  -d '{"dryRun":true}'
```

**Pass:** Unified live counts ≈ legacy `recipient_count` / known overdue set; no unexplained inflation.

---

## Rollback (functions only)

If anything looks wrong (401s, missing unified rows, recipient mismatch, unexpected live `is_dry_run` flags):

```bash
# From a clean checkout of main (pre-upgrade function code):
git fetch origin main
git checkout origin/main -- \
  supabase/functions/safety-briefing-reminder-sms \
  supabase/functions/safety-briefing-escalation-sms \
  supabase/functions/payroll-hours-reminder-sms \
  supabase/functions/send-mass-sms

supabase functions deploy safety-briefing-reminder-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy safety-briefing-escalation-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy payroll-hours-reminder-sms --project-ref emqqxfzahmwnehxcpxzp
supabase functions deploy send-mass-sms --project-ref emqqxfzahmwnehxcpxzp
```

### Is function-only rollback safe with the new tables?

**Yes.** Chunk 1–3 tables (`sms_message_log`, `sms_opt_out_events`, compat view) are **additive**. Pre-upgrade function code does not require them and does not DROP them. Rolling back the four SMS send functions restores prior send/logging behavior against legacy tables; new tables simply stop receiving inserts from those paths until re-deployed. Leave migrations in place. Do **not** drop tables as part of this rollback.

Inbound webhook / reconcile functions can remain deployed (reconcile cron stays `active=false`; apply mode off) unless they are implicated in the failure.
