/*
  # Fix Safety Announcement Cron Jobs

  ## Problem
  The safety announcement cron was not working due to:
  1. Job ID 3 had a placeholder URL `[YOUR-PROJECT-REF]` instead of the actual project reference
  2. Duplicate/conflicting jobs (Job ID 1 and Job ID 3)
  3. Job ID 1 ran every day instead of weekdays only

  ## Solution
  Remove all existing safety announcement cron jobs and create a single, correctly configured job.
*/

-- Step 1: Remove all existing safety announcement cron jobs
DO $$
BEGIN
  -- Try to unschedule 'daily-safety-announcement' if it exists
  PERFORM cron.unschedule('daily-safety-announcement');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available';
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule daily-safety-announcement: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  -- Try to unschedule 'safety-announcement-7am' if it exists
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available';
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule safety-announcement-7am: %', SQLERRM;
END;
$$;

-- Step 2: Create a single, correctly configured job
-- Schedule: 0 13 * * 1-5 = 7 AM CST (13:00 UTC) Monday-Friday
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 13 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"windowHours": 48}'::jsonb
  );
  $cron$
);

