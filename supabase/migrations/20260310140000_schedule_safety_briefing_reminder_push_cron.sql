/*
  Schedule Safety Briefing Reminder Push (pre–Tier 0) at 12:30 UTC Monday–Friday.

  This pg_cron job calls the safety-briefing-reminder-push Edge Function, which:
  - Sends a push notification at 6:30 AM CST / 7:30 AM CDT to active field users
    who have not completed today's safety briefing
  - Same suppression as Tier 0 (company_calendar, user_absences, new hires)
  - Independent of the 7 AM SMS: Tier 0 SMS re-queries at 7 AM and only sends to those still incomplete

  Cron: 30 12 * * 1-5 (12:30 UTC = 6:30 AM CST / 7:30 AM CDT).

  IMPORTANT: Run scripts/deploy-cron-auth.sh to set the real Authorization (Bearer) key.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'safety-briefing-reminder-push') THEN
    PERFORM cron.schedule(
      'safety-briefing-reminder-push',
      '30 12 * * 1-5',
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
    RAISE NOTICE 'Scheduled safety-briefing-reminder-push. Run deploy-cron-auth.sh to set real auth key.';
  ELSE
    RAISE NOTICE 'safety-briefing-reminder-push already exists; leaving unchanged.';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping safety-briefing-reminder-push schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule safety-briefing-reminder-push: %', SQLERRM;
END;
$$;
