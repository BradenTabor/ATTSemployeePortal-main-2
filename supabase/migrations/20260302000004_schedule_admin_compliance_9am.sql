/*
  Schedule Admin Compliance Summary at 9:00 AM CST Monday–Friday.

  This pg_cron job calls the admin-compliance-cron Edge Function, which:
  - Checks DVIR, Equipment Inspection, and JSA submissions
  - Sends the daily compliance summary email via Gmail
  - Sends manager-specific emails for direct reports
  - Posts summary to Make.com webhook

  Cron: 0 15 * * 1-5 (15:00 UTC = 9:00 AM CST; use 14:00 UTC during CDT).

  IMPORTANT: Only creates the job if it does not already exist. This avoids
  overwriting a working job that was set up manually or by deploy-cron-auth.sh
  with a placeholder. If the job already exists (e.g. from a previous setup),
  it is left unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'admin-compliance-9am') THEN
    PERFORM cron.schedule(
      'admin-compliance-9am',
      '0 15 * * 1-5',  -- Mon-Fri at 15:00 UTC (9 AM CST)
      $cron$
      SELECT net.http_post(
        url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-compliance-cron',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    RAISE NOTICE 'Scheduled admin-compliance-9am. Run deploy-cron-auth.sh to set real auth key.';
  ELSE
    RAISE NOTICE 'admin-compliance-9am already exists; leaving it unchanged.';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping admin-compliance-9am schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule admin-compliance-9am: %', SQLERRM;
END;
$$;
