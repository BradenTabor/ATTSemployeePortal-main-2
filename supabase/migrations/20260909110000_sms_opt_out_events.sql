-- =============================================================================
-- Chunk 3: inbound opt-out event log + kill-switch settings + disabled reconcile cron
-- Additive only — no changes to legacy SMS log tables or app_users column types.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_opt_out_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  user_id uuid,
  keyword text NOT NULL CHECK (keyword IN ('STOP', 'START', 'HELP', 'OTHER')),
  raw_message text,
  provider_message_id text,
  source text NOT NULL CHECK (source IN ('webhook', 'reconciliation', 'admin_manual')),
  applied_operational boolean NOT NULL DEFAULT false,
  applied_marketing boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_opt_out_events IS
  'Audit trail for inbound STOP/START/HELP and reconciliation-driven opt-out changes.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_opt_out_events_provider_message_id
  ON public.sms_opt_out_events (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_opt_out_events_phone_e164
  ON public.sms_opt_out_events (phone_e164);

CREATE INDEX IF NOT EXISTS idx_sms_opt_out_events_received_at
  ON public.sms_opt_out_events (received_at DESC);

ALTER TABLE public.sms_opt_out_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_opt_out_events_admin_select" ON public.sms_opt_out_events;
CREATE POLICY "sms_opt_out_events_admin_select"
  ON public.sms_opt_out_events FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "sms_opt_out_events_service_insert" ON public.sms_opt_out_events;
CREATE POLICY "sms_opt_out_events_service_insert"
  ON public.sms_opt_out_events FOR INSERT TO service_role
  WITH CHECK (true);

GRANT SELECT ON public.sms_opt_out_events TO authenticated;
GRANT ALL ON public.sms_opt_out_events TO service_role;

INSERT INTO public.app_settings (key, value) VALUES
(
  'sms_inbound_webhook_config',
  '{"enabled": true}'::jsonb
),
(
  'sms_optout_reconcile_config',
  '{"apply_enabled": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Nightly reconciliation cron — created DISABLED. Enable via runbook after diff review.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clicksend-optout-reconcile') THEN
      PERFORM cron.schedule(
        'clicksend-optout-reconcile',
        '0 9 * * *',
        $cron$
        SELECT net.http_post(
          url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-optout-reconcile',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
          ),
          body := '{}'::jsonb
        );
        $cron$
      );
      SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'clicksend-optout-reconcile';
      IF v_job_id IS NOT NULL THEN
        PERFORM cron.alter_job(v_job_id, active := false);
      END IF;
      RAISE NOTICE 'Scheduled clicksend-optout-reconcile (DISABLED). Run deploy-cron-auth.sh then enable via runbook.';
    ELSE
      RAISE NOTICE 'clicksend-optout-reconcile already exists; leaving unchanged.';
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping clicksend-optout-reconcile schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule clicksend-optout-reconcile: %', SQLERRM;
END;
$$;
