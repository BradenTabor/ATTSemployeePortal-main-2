/*
  # Schedule Risk Calibration Cron Jobs
  
  ## Overview
  This migration schedules the automated risk calibration system:
  1. auto-tune-risk-algorithm - Weekly Sunday at 02:00 UTC
     - Analyzes prediction accuracy over last 30 days
     - If accuracy < 75%, creates new algorithm config with adjusted multipliers
     - Activates new config immediately (zero-touch)
     
  2. check-algorithm-performance - Daily at 03:00 UTC
     - Checks if current config is underperforming baseline
     - If accuracy drop >= 10%, rolls back to previous version
     - Disables auto-tuning if rollback occurs
     
  3. admin-safety-forecast-cron - Weekdays at 12:30 UTC (6:30 AM CST)
     - Calculates daily risk scores for all active work sites
     - Writes predictions to risk_score_history for calibration tracking
     - Sends email/push notifications to leadership
     
  ## Security
  - All cron jobs authenticate using service role key
  - Edge Functions validate service role OR internal secret
  
  ## Deployment Note
  The SERVICE_ROLE_KEY_PLACEHOLDER must be replaced with your actual
  service role key via Supabase SQL Editor or deployment script.
*/

-- =====================================================
-- 1. Update Monitoring View to Include Calibration Jobs
-- =====================================================

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
  'admin-safety-forecast'
)
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS 
  'Monitoring view for scheduled cron jobs including safety forecasts and risk calibration. Shows execution history, status, and duration.';

-- =====================================================
-- 2. Update Scheduled Jobs View
-- =====================================================

DROP VIEW IF EXISTS public.scheduled_cron_jobs;

CREATE VIEW public.scheduled_cron_jobs 
WITH (security_invoker = true)
AS
SELECT 
  jobname,
  schedule,
  active,
  jobid,
  database,
  command
FROM cron.job
WHERE jobname IN (
  'safety-announcement-7am', 
  'admin-compliance-9am',
  'auto-tune-risk-algorithm',
  'check-algorithm-performance',
  'admin-safety-forecast'
);

GRANT SELECT ON public.scheduled_cron_jobs TO authenticated;

COMMENT ON VIEW public.scheduled_cron_jobs IS 
  'View of scheduled cron jobs for monitoring and debugging.';

-- =====================================================
-- 3. Update Failure Query Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_recent_cron_failures(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  jobname TEXT,
  failed_at TIMESTAMPTZ,
  error_message TEXT
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
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
      'safety-announcement-7am', 
      'admin-compliance-9am',
      'auto-tune-risk-algorithm',
      'check-algorithm-performance',
      'admin-safety-forecast'
    )
  ORDER BY r.start_time DESC;
$$;

-- =====================================================
-- 4. Schedule Auto-Tune Risk Algorithm (Weekly)
-- =====================================================

-- Remove existing job if present
DO $$
BEGIN
  PERFORM cron.unschedule('auto-tune-risk-algorithm');
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule auto-tune-risk-algorithm: %', SQLERRM;
END;
$$;

-- Schedule weekly on Sunday at 02:00 UTC
-- NOTE: Replace SERVICE_ROLE_KEY_PLACEHOLDER with your actual service role key
SELECT cron.schedule(
  'auto-tune-risk-algorithm',
  '0 2 * * 0',  -- Sunday at 02:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/auto-tune-risk-algorithm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- 5. Schedule Check Algorithm Performance (Daily)
-- =====================================================

-- Remove existing job if present
DO $$
BEGIN
  PERFORM cron.unschedule('check-algorithm-performance');
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule check-algorithm-performance: %', SQLERRM;
END;
$$;

-- Schedule daily at 03:00 UTC
-- NOTE: Replace SERVICE_ROLE_KEY_PLACEHOLDER with your actual service role key
SELECT cron.schedule(
  'check-algorithm-performance',
  '0 3 * * *',  -- Daily at 03:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/check-algorithm-performance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- 6. Schedule Admin Safety Forecast (Weekdays)
-- =====================================================

-- Remove existing job if present
DO $$
BEGIN
  PERFORM cron.unschedule('admin-safety-forecast');
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule admin-safety-forecast: %', SQLERRM;
END;
$$;

-- Schedule weekdays at 12:30 UTC (6:30 AM CST)
-- NOTE: Replace SERVICE_ROLE_KEY_PLACEHOLDER with your actual service role key
SELECT cron.schedule(
  'admin-safety-forecast',
  '30 12 * * 1-5',  -- 6:30 AM CST (12:30 UTC) Monday-Friday
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-safety-forecast-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- =====================================================
-- 7. Verification Queries (for testing)
-- =====================================================

-- You can run these queries to verify the setup:
-- SELECT * FROM public.scheduled_cron_jobs;
-- SELECT * FROM public.cron_job_runs ORDER BY start_time DESC LIMIT 20;
-- SELECT * FROM public.get_recent_cron_failures(7);

-- To check specific job schedules:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%risk%' OR jobname LIKE '%forecast%';
