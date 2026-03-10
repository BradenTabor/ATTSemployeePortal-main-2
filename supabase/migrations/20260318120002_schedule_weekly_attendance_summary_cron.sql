/*
  Schedule Weekly Attendance Summary — Monday 7:00 AM CDT (6:00 AM CST).

  Cron: 0 12 * * 1 (Monday 12:00 UTC = 7 AM CDT / 6 AM CST).
  Edge Function: weekly-attendance-summary.

  Deploy: Replace SERVICE_ROLE_KEY_PLACEHOLDER and ensure project URL matches your Supabase project.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-attendance-summary') THEN
    PERFORM cron.unschedule('weekly-attendance-summary');
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available or job not found';
END;
$$;

SELECT cron.schedule(
  'weekly-attendance-summary',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/weekly-attendance-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Include new job in monitoring view
DROP VIEW IF EXISTS public.cron_job_runs;
CREATE VIEW public.cron_job_runs
WITH (security_invoker = true)
AS
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
WHERE j.jobname IN (
  'safety-announcement-7am',
  'admin-compliance-9am',
  'auto-tune-risk-algorithm',
  'check-algorithm-performance',
  'admin-safety-forecast',
  'weekly-safety-audit-report',
  'weekly-attendance-summary'
)
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS
  'Monitoring view for scheduled cron jobs including safety forecasts, risk calibration, weekly safety audit, and weekly attendance summary.';
