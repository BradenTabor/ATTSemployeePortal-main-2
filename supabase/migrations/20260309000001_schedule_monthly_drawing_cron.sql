/*
  # Schedule Monthly Safety Reward Drawing

  ## Overview
  Schedules a pg_cron job to trigger the run-monthly-drawing Edge Function
  at 05:59 UTC on the 28th-31st of each month. The Edge Function itself
  checks whether it's actually the last day of the month in Chicago time
  before proceeding, and has an "already drawn" guard to prevent duplicates.

  ## Timezone note
  05:59 UTC = 11:59 PM CST (Nov-Mar) or 12:59 AM CDT (Mar-Nov).
  During CDT the draw technically happens in the first minute of the new
  month, but this is functionally fine: no users claim at that hour, the
  Edge Function uses Chicago-timezone date extraction for the correct month,
  and the already-drawn check prevents double-draws.

  ## Prerequisites
  - pg_cron and pg_net extensions enabled
  - run-monthly-drawing Edge Function deployed
  - DRAWING_SECRET set as a Supabase secret
*/

DO $$
BEGIN
  PERFORM cron.unschedule('monthly-safety-drawing');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not fully configured, skipping unschedule';
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule existing job: %', SQLERRM;
END;
$$;

DO $$
DECLARE
  project_url TEXT;
  drawing_secret TEXT;
  v_month INT;
  v_year INT;
BEGIN
  project_url := current_setting('app.settings.supabase_url', true);
  IF project_url IS NULL OR project_url = '' THEN
    project_url := 'https://emqqxfzahmwnehxcpxzp.supabase.co';
  END IF;

  -- The cron body includes dynamic year/month from CURRENT_TIMESTAMP AT TIME ZONE
  -- Since pg_cron doesn't support dynamic SQL in the body easily, we pass
  -- a fixed body and let the Edge Function compute the target month from its own clock.
  -- For now, the Edge Function uses the Chicago-timezone current date to determine month.

  PERFORM cron.schedule(
    'monthly-safety-drawing',
    '59 5 28-31 * *',
    format(
      $cron$
      SELECT net.http_post(
        url := '%s/functions/v1/run-monthly-drawing',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-drawing-secret', current_setting('app.settings.drawing_secret', true)
        ),
        body := jsonb_build_object(
          'year', EXTRACT(YEAR FROM (CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago'))::int,
          'month', EXTRACT(MONTH FROM (CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago'))::int
        )
      );
      $cron$,
      project_url
    )
  );

  RAISE NOTICE 'Scheduled monthly-safety-drawing to run at 05:59 UTC on 28th-31st';
END;
$$;

-- Update the scheduled_cron_jobs view to include this new job (match column list from 20260226000000)
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
  'admin-safety-forecast',
  'monthly-safety-drawing'
)
   OR jobname LIKE 'weekly-safety-audit%'
   OR jobname LIKE 'data-retention%';

COMMENT ON VIEW public.scheduled_cron_jobs IS
  'View of scheduled cron jobs for monitoring and debugging';

GRANT SELECT ON public.scheduled_cron_jobs TO authenticated;
