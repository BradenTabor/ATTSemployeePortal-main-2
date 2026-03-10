# Rollback: Safety 5 AM Window (reward claim 5–8 AM, announcement 5 AM, push/SMS 5:20/5:40)

If the 5 AM safety window changes need to be reverted, apply the following in order.

## 1. Reward claim window (back to 6–8 AM)

**Migration (new file or run in SQL Editor):**

```sql
-- Restore 6:00–8:00 AM America/Chicago
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (NOW() AT TIME ZONE 'America/Chicago')::time >= '06:00'::time
    AND (NOW() AT TIME ZONE 'America/Chicago')::time < '08:00'::time
  );
$$;

CREATE OR REPLACE FUNCTION public.check_reward_claim_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_reward_claim_window() THEN
    RAISE EXCEPTION 'Safety rewards can only be claimed between 6 AM and 8 AM Central time.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
```

Redeploy app with `REWARD_CLAIM_START_HOUR = 6` in `src/lib/complianceHelpers.ts` and matching strings in `src/hooks/useAnnouncementRewards.ts` and tests.

---

## 2. Safety announcement cron (back to safety-announcement-7am at 12:00 UTC)

```sql
-- Unschedule 5 AM job
DO $$
BEGIN
  PERFORM cron.unschedule('safety-announcement-5am');
EXCEPTION WHEN others THEN NULL;
END $$;

-- Schedule 7am-named job at 12:00 UTC (6 AM CST / 7 AM CDT)
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 12 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{"windowHours": 48}'::jsonb
  );
  $cron$
);

-- Restore monitoring view and function to reference safety-announcement-7am
CREATE OR REPLACE VIEW public.cron_job_runs AS
SELECT j.jobname, r.runid, r.job_pid, r.status, r.start_time, r.end_time,
  (r.end_time - r.start_time) AS duration, r.return_message
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname IN ('safety-announcement-7am', 'admin-compliance-9am')
ORDER BY r.start_time DESC;

CREATE OR REPLACE FUNCTION public.get_recent_cron_failures(days_back INTEGER DEFAULT 7)
RETURNS TABLE (jobname TEXT, failed_at TIMESTAMPTZ, error_message TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT j.jobname, r.start_time AS failed_at, r.return_message AS error_message
  FROM cron.job j
  JOIN cron.job_run_details r ON j.jobid = r.jobid
  WHERE r.status = 'failed'
    AND r.start_time > NOW() - (days_back || ' days')::INTERVAL
    AND j.jobname IN ('safety-announcement-7am', 'admin-compliance-9am')
  ORDER BY r.start_time DESC;
$$;
```

Replace `SERVICE_ROLE_KEY_PLACEHOLDER` with your key, or run `scripts/deploy-cron-auth.sh` after reverting the script’s block 1 to use `safety-announcement-7am` and `0 12 * * 1-5`.

---

## 3. Safety briefing reminder push and SMS (back to 12:30 UTC and 13:00 UTC)

```sql
DO $$
BEGIN
  PERFORM cron.unschedule('safety-briefing-reminder-push');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule(
  'safety-briefing-reminder-push',
  '30 12 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'),
    body := '{}'::jsonb
  );
  $cron$
);

DO $$
BEGIN
  PERFORM cron.unschedule('safety-briefing-reminder-sms');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule(
  'safety-briefing-reminder-sms',
  '0 13 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-sms',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'),
    body := '{}'::jsonb
  );
  $cron$
);
```

---

## 4. Verification after rollback

- `SELECT jobname, schedule FROM cron.job WHERE jobname IN ('safety-announcement-7am', 'safety-briefing-reminder-push', 'safety-briefing-reminder-sms');`  
  Expect: `safety-announcement-7am` → `0 12 * * 1-5`, push → `30 12 * * 1-5`, sms → `0 13 * * 1-5`.
- `SELECT jobname FROM cron.job WHERE jobname = 'safety-announcement-5am';`  
  Expect: zero rows.
- App: claim window 6–8 AM; docs and deploy script reverted to 6 AM / 7 AM references.
