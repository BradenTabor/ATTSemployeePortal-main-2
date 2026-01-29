-- =============================================================================
-- Notify admins on new signup — create webhook via SQL (bypasses Dashboard)
-- =============================================================================
-- Use this when the Dashboard keeps reverting "HTTP Request" to "Supabase Edge
-- Functions" and Save shows "Webhook not found". This creates the same webhook
-- using pg_net so it never goes through the Dashboard's type logic.
--
-- Target: admin-create-notification (supports internal auth via x-internal-key;
-- no user JWT required). Alternatively use notify-admins-new-signup.
--
-- Before running:
-- 1. Replace YOUR_INTERNAL_SECRET with your INTERNAL_SECRET (Edge Functions → Secrets).
-- 2. Replace YOUR_ANON_KEY with your project's anon public key (Project Settings → API).
--    The gateway requires a valid JWT in Authorization; the function uses x-internal-key.
-- 3. Ensure pg_net is enabled (Extensions in Dashboard).
-- 4. Run this entire script in Supabase Dashboard → SQL Editor.
-- =============================================================================

-- Drop existing trigger and function so we can re-run this script
DROP TRIGGER IF EXISTS notify_admins_on_new_signup ON public.app_users;
DROP FUNCTION IF EXISTS public.notify_admins_new_signup_webhook();

CREATE OR REPLACE FUNCTION public.notify_admins_new_signup_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_url text := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-create-notification';
  internal_secret text := 'YOUR_INTERNAL_SECRET';  -- REPLACE: Edge Functions → Secrets
  anon_key text := 'YOUR_ANON_KEY';                -- REPLACE: Project Settings → API → anon public
  payload jsonb;
  request_id bigint;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'app_users',
    'schema', 'public',
    'record', to_jsonb(NEW),
    'old_record', null
  );

  SELECT net.http_post(
    url := webhook_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-internal-key', internal_secret
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_admins_new_signup_webhook() IS
  'Trigger: POST to admin-create-notification (or notify-admins-new-signup) on app_users INSERT. Uses x-internal-key for internal auth.';

CREATE TRIGGER notify_admins_on_new_signup
  AFTER INSERT ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_signup_webhook();
