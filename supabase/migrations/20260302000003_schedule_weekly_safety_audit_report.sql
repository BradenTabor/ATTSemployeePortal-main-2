/*
  Schedule Weekly Safety Audit Report — Friday 5:00 PM CST.

  Cron: 0 23 * * 5 (11 PM UTC = 5 PM CST standard time; 6 PM CDT during DST).
  Edge Function: weekly-safety-audit-report.

  Deploy: Replace SERVICE_ROLE_KEY_PLACEHOLDER and ensure project URL matches your Supabase project.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-safety-audit-report') THEN
    PERFORM cron.unschedule('weekly-safety-audit-report');
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available or job not found';
END;
$$;

SELECT cron.schedule(
  'weekly-safety-audit-report',
  '0 23 * * 5',  -- Friday 11 PM UTC = 5 PM CST (standard); 6 PM CDT (DST)
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/weekly-safety-audit-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Include new job in monitoring view (recreate view with added job name)
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
  'weekly-safety-audit-report'
)
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS
  'Monitoring view for scheduled cron jobs including safety forecasts, risk calibration, and weekly safety audit.';
