-- =============================================================================
-- Update all cron jobs with your service role key (Dashboard method)
-- =============================================================================
--
-- Use this when you don't have the database password (e.g. forgot it).
--
-- 1. Open Supabase Dashboard → SQL Editor → New query
-- 2. Get your service_role key: Settings → API → Project API keys → service_role (secret)
-- 3. Replace YOUR_SERVICE_ROLE_KEY_HERE below with that key (paste the whole JWT)
-- 4. Run the script (Run button)
--
-- Your key stays in the Dashboard only; it is not committed to the repo.
-- =============================================================================

DO $$
DECLARE
  -- PASTE YOUR SERVICE ROLE KEY BETWEEN THE QUOTES (from Settings → API → service_role):
  k text := 'YOUR_SERVICE_ROLE_KEY_HERE';
  c text;
BEGIN
  IF k = 'YOUR_SERVICE_ROLE_KEY_HERE' OR k = '' THEN
    RAISE EXCEPTION 'Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service_role key from Supabase Dashboard → Settings → API';
  END IF;

  -- 1. Safety Announcement (5 AM Central Mon-Fri, 10:00 UTC) – matches reward claim 5–8 AM
  BEGIN PERFORM cron.unschedule('safety-announcement-7am'); EXCEPTION WHEN others THEN NULL; END;
  BEGIN PERFORM cron.unschedule('safety-announcement-5am'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{"windowHours": 48}''::jsonb)';
  PERFORM cron.schedule('safety-announcement-5am', '0 10 * * 1-5', c);

  -- 2. Admin Compliance Summary (9 AM CST Mon-Fri)
  BEGIN PERFORM cron.unschedule('admin-compliance-9am'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-compliance-cron'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('admin-compliance-9am', '0 15 * * 1-5', c);

  -- 3. Admin Safety Forecast (6:30 AM CST Mon-Fri)
  BEGIN PERFORM cron.unschedule('admin-safety-forecast'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-safety-forecast-cron'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('admin-safety-forecast', '30 12 * * 1-5', c);

  -- 4. Auto-Tune Risk Algorithm (Sunday 2 AM UTC)
  BEGIN PERFORM cron.unschedule('auto-tune-risk-algorithm'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/auto-tune-risk-algorithm'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('auto-tune-risk-algorithm', '0 2 * * 0', c);

  -- 5. Check Algorithm Performance (Daily 3 AM UTC)
  BEGIN PERFORM cron.unschedule('check-algorithm-performance'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/check-algorithm-performance'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('check-algorithm-performance', '0 3 * * *', c);

  -- 6. Safety Briefing Reminder Push (5:20 AM CDT Mon-Fri, 10:20 UTC)
  BEGIN PERFORM cron.unschedule('safety-briefing-reminder-push'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-push'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('safety-briefing-reminder-push', '20 10 * * 1-5', c);

  -- 7. Safety Briefing Reminder SMS (5:40 AM CDT Mon-Fri, 10:40 UTC)
  BEGIN PERFORM cron.unschedule('safety-briefing-reminder-sms'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-sms'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('safety-briefing-reminder-sms', '40 10 * * 1-5', c);

  -- 8. Safety Briefing Escalation SMS (10 AM CST Mon-Fri)
  BEGIN PERFORM cron.unschedule('safety-briefing-escalation-sms'); EXCEPTION WHEN others THEN NULL; END;
  c := 'SELECT net.http_post(url := ''https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-escalation-sms'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer ' || k || '''), body := ''{}''::jsonb)';
  PERFORM cron.schedule('safety-briefing-escalation-sms', '0 16 * * 1-5', c);

  RAISE NOTICE 'Cron jobs updated successfully.';
END $$;

-- Verify
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname IN (
  'safety-announcement-5am',
  'admin-compliance-9am',
  'admin-safety-forecast',
  'auto-tune-risk-algorithm',
  'check-algorithm-performance',
  'safety-briefing-reminder-push',
  'safety-briefing-reminder-sms',
  'safety-briefing-escalation-sms'
)
ORDER BY jobname;
