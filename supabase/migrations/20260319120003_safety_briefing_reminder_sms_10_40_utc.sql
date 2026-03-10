-- Reschedule safety briefing reminder SMS to 10:40 UTC (5:40 AM CDT), 20 min after push (10:20 UTC).
-- Rollback: see docs/rollback-safety-5am.md.

DO $$
BEGIN
  PERFORM cron.unschedule('safety-briefing-reminder-sms');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-briefing-reminder-sms did not exist';
END $$;

SELECT cron.schedule(
  'safety-briefing-reminder-sms',
  '40 10 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
