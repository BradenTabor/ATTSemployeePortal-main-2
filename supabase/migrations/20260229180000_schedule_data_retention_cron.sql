/*
  Schedule run_data_retention() daily via pg_cron (3 AM UTC).
  Deletes compliance records older than retention_days per data_retention_policies.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('run-data-retention');
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule run-data-retention: %', SQLERRM;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'run-data-retention',
      '0 3 * * *',  -- Daily at 03:00 UTC
      'SELECT * FROM public.run_data_retention();'
    );
    RAISE NOTICE 'Scheduled run-data-retention (daily 03:00 UTC)';
  ELSE
    RAISE NOTICE 'pg_cron not available, skipping data retention schedule';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not schedule run-data-retention: %', SQLERRM;
END;
$$;
