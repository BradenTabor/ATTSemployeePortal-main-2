/*
  # Cron Monitoring and Security Enhancements
  
  ## Overview
  This migration adds:
  1. Monitoring view for cron job execution history
  2. Helper function to query recent failures
  3. Updated cron job with service role authentication
  
  ## Security
  - Cron jobs now authenticate using service role key
  - Edge Function accepts both service role AND internal secret
  - Prevents unauthorized triggering of scheduled functions
  
  ## Deployment Note
  The SERVICE_ROLE_KEY_PLACEHOLDER must be replaced with your actual
  service role key. Options:
  1. Replace manually via Supabase SQL Editor (recommended)
  2. Use scripts/deploy-cron-auth.sh
  3. Replace in this file locally (don't commit the key)
*/

-- =====================================================
-- 1. Monitoring View
-- =====================================================

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
WHERE j.jobname IN ('safety-announcement-7am', 'admin-compliance-9am')
ORDER BY r.start_time DESC;

-- Grant read access to authenticated users
GRANT SELECT ON public.cron_job_runs TO authenticated;

-- Add documentation comment
COMMENT ON VIEW public.cron_job_runs IS 
  'Monitoring view for safety-related scheduled cron jobs. Shows execution history, status, and duration.';

-- =====================================================
-- 2. Helper Function for Recent Failures
-- =====================================================

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
    AND j.jobname IN ('safety-announcement-7am', 'admin-compliance-9am')
  ORDER BY r.start_time DESC;
$$;

-- Grant execute access
GRANT EXECUTE ON FUNCTION public.get_recent_cron_failures TO authenticated;

-- Add documentation comment
COMMENT ON FUNCTION public.get_recent_cron_failures IS 
  'Returns recent cron job failures within the specified number of days (default: 7).';

-- =====================================================
-- 3. Update Cron Job with Service Role Authentication
-- =====================================================

-- Remove existing job
DO $$
BEGIN
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule safety-announcement-7am: %', SQLERRM;
END;
$$;

-- Create new job with authentication header
-- NOTE: Replace SERVICE_ROLE_KEY_PLACEHOLDER with your actual service role key
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 13 * * 1-5',  -- 7 AM CST (13:00 UTC) Monday-Friday
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{"windowHours": 48}'::jsonb
  );
  $$
);

-- =====================================================
-- 4. Verification Query (for testing)
-- =====================================================

-- You can run these queries to verify the setup:
-- SELECT * FROM public.cron_job_runs LIMIT 10;
-- SELECT * FROM public.get_recent_cron_failures(7);
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'safety-announcement-7am';

