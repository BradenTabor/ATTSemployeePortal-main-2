/*
  # Schedule Daily Safety Announcement Generation (7 AM CST)

  ## Overview
  Creates a pg_cron scheduled job to generate safety announcements at 7:00 AM Central 
  Time, Monday through Friday.

  ## Schedule Details
  - Time: 7:00 AM America/Chicago (CST/CDT)
  - Days: Monday through Friday only (1-5)
  - UTC Hour: 13:00 during CST, 12:00 during CDT (handled by Edge Function timezone logic)
  - Window: Analyzes last 48 hours of safety data

  ## Data Sources
  The Edge Function fetches and aggregates data from:
  - `daily_jsa` - Job Safety Analysis forms
  - `dvir_reports` - Daily Vehicle Inspection Reports
  - `daily_equipment_inspections` - Equipment inspection records

  ## Output
  - Saves announcement to `announcements` table with author "Safety AI"
  - Sends high-priority push notification to all users
  - Skips weekends automatically

  ## Prerequisites
  - Enable pg_cron extension
  - Enable pg_net extension
  - Deploy generate-safety-announcement Edge Function
  - Set OPENAI_API_KEY secret on the Edge Function

  ## Notes
  - The cron runs at 13:00 UTC which is 7:00 AM CST (Central Standard Time)
  - During CDT (Daylight Saving), the announcement will run at 8:00 AM Central
  - To maintain 7:00 AM during CDT, change to 12:00 UTC (0 12 * * 1-5)
  - The Edge Function has its own weekday check for safety
*/

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists (for idempotency)
DO $$
BEGIN
  -- Unschedule by name if exists
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not fully configured, skipping unschedule';
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule existing job: %', SQLERRM;
END;
$$;

-- Schedule the safety announcement generation
-- 0 13 * * 1-5 = 13:00 UTC (7:00 AM CST) on weekdays
DO $$
DECLARE
  project_url TEXT;
BEGIN
  -- Get the Supabase project URL from environment or use placeholder
  -- NOTE: Replace [YOUR-PROJECT-REF] with your actual project reference
  project_url := current_setting('app.settings.supabase_url', true);
  
  IF project_url IS NULL OR project_url = '' THEN
    -- Use a placeholder that must be replaced
    project_url := 'https://[YOUR-PROJECT-REF].supabase.co';
    RAISE NOTICE 'WARNING: Using placeholder URL. Update the cron job with your actual Supabase project URL.';
  END IF;

  -- Schedule the job
  PERFORM cron.schedule(
    'safety-announcement-7am',           -- Job name
    '0 13 * * 1-5',                       -- Cron expression: 7 AM CST Mon-Fri
    format(
      $cron$
      SELECT net.http_post(
        url := '%s/functions/v1/generate-safety-announcement',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"windowHours": 48}'::jsonb
      );
      $cron$,
      project_url
    )
  );
  
  RAISE NOTICE 'Scheduled safety-announcement-7am to run at 13:00 UTC (7 AM CST) Mon-Fri';
  RAISE NOTICE 'Target URL: %/functions/v1/generate-safety-announcement', project_url;
END;
$$;

-- Create a view to easily check the scheduled job
CREATE OR REPLACE VIEW public.scheduled_cron_jobs AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname LIKE 'safety-announcement%' 
   OR jobname LIKE 'admin-compliance%';

-- Add comment for documentation
COMMENT ON VIEW public.scheduled_cron_jobs IS 
  'View of safety-related scheduled cron jobs for monitoring and debugging';

-- Grant access to view for authenticated users (read-only)
GRANT SELECT ON public.scheduled_cron_jobs TO authenticated;

