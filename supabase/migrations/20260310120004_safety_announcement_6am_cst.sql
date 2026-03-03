-- =============================================================================
-- Safety announcement: run at 6 AM CST to match reward claim window (6–8 AM).
-- Previously 7 AM CST (13:00 UTC); now 6 AM CST (12:00 UTC).
-- =============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-announcement-7am did not exist';
END $$;

-- Reschedule at 12:00 UTC = 6 AM CST / 7 AM CDT (Mon–Fri)
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 12 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
    ),
    body := '{"windowHours": 48}'::jsonb
  );
  $cron$
);
