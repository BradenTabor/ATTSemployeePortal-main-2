-- Include all active safety/compliance cron jobs in monitoring view and failure helper.
-- Fixes gap where 20260319120001 left only safety-announcement-5am and admin-compliance-9am,
-- making weekly-attendance-summary and reminder push/SMS invisible to the dashboard.

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
  'safety-announcement-5am',
  'admin-compliance-9am',
  'weekly-attendance-summary',
  'safety-briefing-reminder-push',
  'safety-briefing-reminder-sms'
)
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS
  'Monitoring view for safety/compliance cron jobs: announcement, compliance check, weekly attendance summary, briefing reminders (push + SMS).';

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
    AND j.jobname IN (
      'safety-announcement-5am',
      'admin-compliance-9am',
      'weekly-attendance-summary',
      'safety-briefing-reminder-push',
      'safety-briefing-reminder-sms'
    )
  ORDER BY r.start_time DESC;
$$;
