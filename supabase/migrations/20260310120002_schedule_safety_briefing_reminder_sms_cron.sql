/*
  Schedule Safety Briefing Reminder SMS (Tier 0) at 13:00 UTC Monday–Friday.

  This pg_cron job calls the safety-briefing-reminder-sms Edge Function, which:
  - Sends a morning nudge (7 AM CST / 8 AM CDT) to active field employees
    who have not completed today's safety briefing
  - Suppresses on company_calendar, user_absences, and new hires
  - Logs to sms_escalation_send_log with tier = 0

  Cron: 0 13 * * 1-5 (13:00 UTC = 7 AM CST / 8 AM CDT).

  IMPORTANT: Only creates the job if it does not already exist. Run
  scripts/deploy-cron-auth.sh to set the real Authorization (Bearer) key.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'safety-briefing-reminder-sms') THEN
    PERFORM cron.schedule(
      'safety-briefing-reminder-sms',
      '0 13 * * 1-5',  -- Mon–Fri 13:00 UTC (7 AM CST / 8 AM CDT)
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
    RAISE NOTICE 'Scheduled safety-briefing-reminder-sms. Run deploy-cron-auth.sh to set real auth key.';
  ELSE
    RAISE NOTICE 'safety-briefing-reminder-sms already exists; leaving unchanged.';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping safety-briefing-reminder-sms schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule safety-briefing-reminder-sms: %', SQLERRM;
END;
$$;
