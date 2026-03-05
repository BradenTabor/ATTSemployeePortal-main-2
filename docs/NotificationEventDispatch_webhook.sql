-- =============================================================================
-- Dispatch notifications when a row is inserted into notification_events
-- =============================================================================
-- Use this so trigger-created events (e.g. external cert grant/revocation) get
-- delivered. The trigger POSTs to notifications-dispatch with the new event id.
--
-- Before running:
-- 1. Replace YOUR_INTERNAL_SECRET with your INTERNAL_SECRET (Edge Functions → Secrets).
-- 2. Replace YOUR_ANON_KEY with your project's anon public key (Project Settings → API).
--    The gateway requires a valid JWT in Authorization; dispatch validates x-internal-key.
-- 3. Ensure pg_net is enabled (Database → Extensions).
-- 4. Run this entire script in Supabase Dashboard → SQL Editor.
-- =============================================================================

-- Drop existing so we can re-run
DROP TRIGGER IF EXISTS notification_events_dispatch_on_insert ON public.notification_events;
DROP FUNCTION IF EXISTS public.notification_events_dispatch_webhook();

CREATE OR REPLACE FUNCTION public.notification_events_dispatch_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dispatch_url text := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/notifications-dispatch';
  internal_secret text := 'YOUR_INTERNAL_SECRET';  -- REPLACE: Edge Functions → Secrets
  anon_key text := 'YOUR_ANON_KEY';                -- REPLACE: Project Settings → API → anon public
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := dispatch_url,
    body := jsonb_build_object('event_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-internal-key', internal_secret
    ),
    timeout_milliseconds := 10000
  ) INTO request_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notification_events_dispatch_webhook() IS
  'Trigger: POST to notifications-dispatch on notification_events INSERT so trigger-created events (e.g. cert grant/revocation) are delivered.';

CREATE TRIGGER notification_events_dispatch_on_insert
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.notification_events_dispatch_webhook();
