-- =============================================================================
-- Safety announcement: run at 5 AM Central (10:00 UTC). Rename job to
-- safety-announcement-5am. 10:00 UTC = 5 AM CDT / 4 AM CST (pg_cron is fixed UTC).
-- Matches reward claim window 5–8 AM. Update monitoring view/function.
-- Rollback: see docs/rollback-safety-5am.md.
-- =============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-announcement-7am did not exist';
END $$;

-- Schedule new job at 10:00 UTC (5 AM CDT / 4 AM CST) Mon–Fri
SELECT cron.schedule(
  'safety-announcement-5am',
  '0 10 * * 1-5',
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

-- Update monitoring view to reference new job name
CREATE OR REPLACE VIEW public.cron_job_runs AS
SELECT
  j.jobname,
  r.runid,
  r.job_pid,
  r.status,
  r.start_time,
  r.end_time,
  (r.end_time - r.start_time) AS duration,
  r.return_message
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname IN ('safety-announcement-5am', 'admin-compliance-9am')
ORDER BY r.start_time DESC;

-- Update helper to reference new job name
CREATE OR REPLACE FUNCTION public.get_recent_cron_failures(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  jobname TEXT,
  failed_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    j.jobname,
    r.start_time AS failed_at,
    r.return_message AS error_message
  FROM cron.job j
  JOIN cron.job_run_details r ON j.jobid = r.jobid
  WHERE r.status = 'failed'
    AND r.start_time > NOW() - (days_back || ' days')::INTERVAL
    AND j.jobname IN ('safety-announcement-5am', 'admin-compliance-9am')
  ORDER BY r.start_time DESC;
$$;
