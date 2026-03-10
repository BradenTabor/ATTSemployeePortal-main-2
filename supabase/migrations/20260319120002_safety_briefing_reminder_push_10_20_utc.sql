-- Reschedule safety briefing reminder push to 10:20 UTC (5:20 AM CDT), 20 min after announcement (10:00 UTC).
-- Rollback: see docs/rollback-safety-5am.md.

DO $$
BEGIN
  PERFORM cron.unschedule('safety-briefing-reminder-push');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-briefing-reminder-push did not exist';
END $$;

SELECT cron.schedule(
  'safety-briefing-reminder-push',
  '20 10 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
