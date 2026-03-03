/*
  Schedule Safety Briefing Escalation SMS at 16:00 UTC Monday–Friday.

  This pg_cron job calls the safety-briefing-escalation-sms Edge Function, which:
  - Computes D1 (previous business day) and D2 (2 business days ago) in America/Chicago
  - Finds active field users overdue on daily safety briefing (briefing-only)
  - Sends SMS via ClickSend to tier-1 and tier-2 recipients when overdue lists are non-empty
  - Logs to sms_escalation_send_log for idempotency and cost tracking

  Cron: 0 16 * * 1-5 (16:00 UTC, Monday–Friday).
  No seasonal adjustment. 16:00 UTC = 10:00 AM CST (winter) / 11:00 AM CDT (summer).

  IMPORTANT: Only creates the job if it does not already exist. Run deploy-cron-auth.sh
  to set the real Authorization (Bearer) key for cron invocation.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'safety-briefing-escalation-sms') THEN
    PERFORM cron.schedule(
      'safety-briefing-escalation-sms',
      '0 16 * * 1-5',  -- Mon–Fri 16:00 UTC (10 AM CST / 11 AM CDT)
      $cron$
      SELECT net.http_post(
        url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-escalation-sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    RAISE NOTICE 'Scheduled safety-briefing-escalation-sms. Run deploy-cron-auth.sh to set real auth key.';
  ELSE
    RAISE NOTICE 'safety-briefing-escalation-sms already exists; leaving unchanged.';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping safety-briefing-escalation-sms schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule safety-briefing-escalation-sms: %', SQLERRM;
END;
$$;
