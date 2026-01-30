-- Restore 9 AM compliance email cron job (run in Supabase SQL Editor)
-- Use when the job was overwritten by a migration with SERVICE_ROLE_KEY_PLACEHOLDER.
--
-- 1. In Supabase Dashboard → Settings → API, copy your service_role key (secret).
-- 2. Replace YOUR_SERVICE_ROLE_KEY below with that key (keep the single quotes).
-- 3. Run this entire script in SQL Editor.

DO $$
BEGIN
  PERFORM cron.unschedule('admin-compliance-9am');
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not unschedule: %', SQLERRM;
END;
$$;

SELECT cron.schedule(
  'admin-compliance-9am',
  '0 15 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-compliance-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify: SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'admin-compliance-9am';
