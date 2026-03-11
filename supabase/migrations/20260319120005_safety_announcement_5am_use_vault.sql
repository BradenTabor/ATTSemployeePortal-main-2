-- =============================================================================
-- Safety announcement 5 AM: use Vault for cron auth (no placeholder key)
-- When Vault is enabled, the cron calls run_safety_announcement_5am() which
-- reads CRON_SERVICE_ROLE_KEY from Vault. Add that secret in Dashboard
-- (Project → Vault → Secrets): name CRON_SERVICE_ROLE_KEY, value = service_role key.
-- If Vault is not enabled, cron is unchanged; use scripts/deploy-cron-auth.sh instead.
-- =============================================================================

DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vault') THEN
    CREATE OR REPLACE FUNCTION public.run_safety_announcement_5am()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
    DECLARE
      v_key text;
    BEGIN
      SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
      WHERE name = 'CRON_SERVICE_ROLE_KEY'
      LIMIT 1;
      IF v_key IS NULL OR trim(v_key) = '' THEN
        RAISE NOTICE 'safety-announcement-5am: CRON_SERVICE_ROLE_KEY not set in Vault; skipping. Add it in Dashboard → Vault → Secrets.';
        RETURN;
      END IF;
      PERFORM net.http_post(
        url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
        body := '{"windowHours": 48}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
        )
      );
    END;
    $func$;

    COMMENT ON FUNCTION public.run_safety_announcement_5am() IS
      'Called by pg_cron at 5 AM Central. Reads CRON_SERVICE_ROLE_KEY from Vault and POSTs to generate-safety-announcement.';

    PERFORM cron.unschedule('safety-announcement-5am');
    PERFORM cron.schedule(
      'safety-announcement-5am',
      '0 10 * * 1-5',
      'SELECT public.run_safety_announcement_5am()'
    );
    RAISE NOTICE 'safety-announcement-5am now uses Vault. Add secret CRON_SERVICE_ROLE_KEY (value = service_role key) in Dashboard → Vault if not already set.';
  ELSE
    RAISE NOTICE 'Vault extension not enabled. To fix 5 AM safety message: run scripts/deploy-cron-auth.sh with SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL, or enable Vault and add CRON_SERVICE_ROLE_KEY.';
  END IF;
END $outer$;
