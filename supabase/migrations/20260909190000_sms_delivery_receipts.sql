-- =============================================================================
-- Delivery receipts: the carrier outcome, recorded as a fact distinct from the
-- provider's submission response.
--
-- sms_message_log.provider_status is what ClickSend said when it accepted the
-- message. It is never rewritten here. delivery_status is what happened after
-- that, pulled from GET /v3/sms/history and keyed on provider_message_id.
--
-- Additive only: new columns, one new table, and the compat view gains columns
-- at the end. No legacy SMS table is touched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Delivery columns on the unified log (null until a receipt is matched)
-- -----------------------------------------------------------------------------

ALTER TABLE public.sms_message_log
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_error_code text,
  ADD COLUMN IF NOT EXISTS delivery_raw jsonb;

COMMENT ON COLUMN public.sms_message_log.provider_status IS
  'ClickSend''s response at submission time (SUCCESS = accepted for sending). NOT delivery confirmation.';
COMMENT ON COLUMN public.sms_message_log.delivery_status IS
  'Carrier outcome from the delivery receipt: delivered | sent_to_network | failed | cancelled | queued | unknown. Null = no receipt seen yet.';
COMMENT ON COLUMN public.sms_message_log.delivery_status_at IS
  'Provider timestamp on the delivery receipt.';
COMMENT ON COLUMN public.sms_message_log.delivery_error_code IS
  'Provider error_code from the delivery receipt (e.g. 12 = absent subscriber, 15 = rejected by network).';
COMMENT ON COLUMN public.sms_message_log.delivery_raw IS
  'Raw provider receipt payload, kept for audit.';

CREATE INDEX IF NOT EXISTS idx_sms_message_log_provider_message_id
  ON public.sms_message_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_message_log_delivery_status
  ON public.sms_message_log (delivery_status)
  WHERE delivery_status IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Receipt ledger — one row per provider_message_id, matched or not
--
-- Unmatched receipts are kept deliberately. The ClickSend account is shared with
-- an external purchase-order app, and its traffic showing up here is the evidence
-- of that; dropping it would erase the only signal we have.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sms_delivery_receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_message_id text NOT NULL,
  delivery_status text NOT NULL CHECK (
    delivery_status IN ('delivered', 'sent_to_network', 'failed', 'cancelled', 'queued', 'unknown')
  ),
  delivery_status_at timestamptz,
  provider_status_code text,
  provider_status_text text,
  delivery_error_code text,
  delivery_error_text text,
  to_number text,
  from_number text,
  matched_log_id uuid REFERENCES public.sms_message_log (id) ON DELETE SET NULL,
  is_matched boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'history_pull' CHECK (source IN ('history_pull', 'webhook', 'backfill')),
  raw jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_delivery_receipt IS
  'Carrier delivery outcomes pulled from ClickSend, keyed by provider_message_id. Includes receipts with no matching portal send (shared-account traffic).';
COMMENT ON COLUMN public.sms_delivery_receipt.is_matched IS
  'true = a portal send carries this provider_message_id (sms_message_log or a legacy row in sms_message_log_compat). false = traffic from another app on the shared ClickSend account; kept as evidence, not an error.';
COMMENT ON COLUMN public.sms_delivery_receipt.matched_log_id IS
  'Set only when the send lives in sms_message_log. Legacy compat rows have no updatable row, so they match on provider_message_id alone.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_delivery_receipt_message_id
  ON public.sms_delivery_receipt (provider_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_receipt_status
  ON public.sms_delivery_receipt (delivery_status);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_receipt_unmatched
  ON public.sms_delivery_receipt (first_seen_at DESC)
  WHERE is_matched = false;

ALTER TABLE public.sms_delivery_receipt ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_delivery_receipt_admin_select" ON public.sms_delivery_receipt;
CREATE POLICY "sms_delivery_receipt_admin_select"
  ON public.sms_delivery_receipt FOR SELECT TO authenticated
  USING (public.is_admin());

-- Idempotency is enforced here rather than in the caller, so re-ingesting a window
-- is a no-op no matter who does it — the nightly cron, a manual replay, or the
-- one-off backfill. Returning NULL from a BEFORE UPDATE row trigger cancels the
-- write, which leaves updated_at, first_seen_at and source untouched.
CREATE OR REPLACE FUNCTION public.sms_delivery_receipt_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_status IS NOT DISTINCT FROM OLD.delivery_status
     AND NEW.delivery_status_at IS NOT DISTINCT FROM OLD.delivery_status_at
     AND NEW.provider_status_code IS NOT DISTINCT FROM OLD.provider_status_code
     AND NEW.provider_status_text IS NOT DISTINCT FROM OLD.provider_status_text
     AND NEW.delivery_error_code IS NOT DISTINCT FROM OLD.delivery_error_code
     AND NEW.delivery_error_text IS NOT DISTINCT FROM OLD.delivery_error_text
     AND NEW.to_number IS NOT DISTINCT FROM OLD.to_number
     AND NEW.from_number IS NOT DISTINCT FROM OLD.from_number
     AND NEW.matched_log_id IS NOT DISTINCT FROM OLD.matched_log_id
     AND NEW.is_matched IS NOT DISTINCT FROM OLD.is_matched
     AND NEW.raw IS NOT DISTINCT FROM OLD.raw
  THEN
    RETURN NULL;
  END IF;

  -- The first sighting of a receipt is a fact of its own; a later pull does not move it.
  NEW.first_seen_at := OLD.first_seen_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_sms_delivery_receipt_updated_at ON public.sms_delivery_receipt;
CREATE TRIGGER set_sms_delivery_receipt_updated_at
  BEFORE UPDATE ON public.sms_delivery_receipt
  FOR EACH ROW EXECUTE FUNCTION public.sms_delivery_receipt_touch();

GRANT SELECT ON public.sms_delivery_receipt TO authenticated;
GRANT ALL ON public.sms_delivery_receipt TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Compat view gains delivery columns at the end.
--
-- The historical rows in this view come from legacy tables that must not be
-- rewritten, so their delivery state is joined in from the receipt ledger by
-- provider_message_id rather than stored on the row.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.sms_message_log_compat
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    l.id,
    l.user_id,
    l.phone_e164,
    l.message_type,
    l.category,
    l.from_number,
    l.body,
    l.template_key,
    l.provider_message_id,
    l.provider_status,
    l.price,
    l.opt_out_state_at_send,
    l.run_id,
    l.source_table,
    l.is_dry_run,
    l.sent_at,
    l.created_at,
    l.updated_at,
    l.delivery_status AS row_delivery_status,
    l.delivery_status_at AS row_delivery_status_at,
    l.delivery_error_code AS row_delivery_error_code
  FROM public.sms_message_log l

  UNION ALL

  SELECT
    public.sms_compat_uuid(esc.id::text || ':esc:' || ord.ordinality::text) AS id,
    au_esc.user_id AS user_id,
    NULLIF(ord.m->>'to', '') AS phone_e164,
    CASE esc.tier
      WHEN 0 THEN 'safety_briefing_reminder'
      WHEN 1 THEN 'safety_briefing_escalation_t1'
      WHEN 2 THEN 'safety_briefing_escalation_t2'
      ELSE 'safety_briefing_escalation'
    END AS message_type,
    'operational'::text AS category,
    NULL::text AS from_number,
    NULL::text AS body,
    NULL::text AS template_key,
    COALESCE(ord.m->>'messageId', ord.m->>'message_id') AS provider_message_id,
    ord.m->>'status' AS provider_status,
    NULLIF(COALESCE(ord.m->>'price', ord.m->>'message_price'), '')::numeric AS price,
    NULL::jsonb AS opt_out_state_at_send,
    esc.id AS run_id,
    'sms_escalation_send_log'::text AS source_table,
    false AS is_dry_run,
    esc.sent_at,
    esc.sent_at AS created_at,
    esc.sent_at AS updated_at,
    NULL::text AS row_delivery_status,
    NULL::timestamptz AS row_delivery_status_at,
    NULL::text AS row_delivery_error_code
  FROM public.sms_escalation_send_log esc
  CROSS JOIN LATERAL jsonb_array_elements(esc.results) WITH ORDINALITY AS ord(m, ordinality)
  LEFT JOIN public.app_users au_esc
    ON public.normalize_phone_to_e164(au_esc.phone_number)
     = public.normalize_phone_to_e164(NULLIF(ord.m->>'to', ''))
  WHERE jsonb_typeof(esc.results) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM public.sms_message_log n
      WHERE n.run_id = esc.id
        AND n.source_table = 'sms_escalation_send_log'
        AND n.is_dry_run = false
    )

  UNION ALL

  SELECT
    public.sms_compat_uuid(pay.id::text || ':pay:' || ord.ordinality::text) AS id,
    au_pay.user_id AS user_id,
    NULLIF(ord.m->>'to', '') AS phone_e164,
    'payroll_reminder'::text AS message_type,
    'operational'::text AS category,
    NULL::text AS from_number,
    NULL::text AS body,
    NULL::text AS template_key,
    COALESCE(ord.m->>'messageId', ord.m->>'message_id') AS provider_message_id,
    ord.m->>'status' AS provider_status,
    NULLIF(COALESCE(ord.m->>'price', ord.m->>'message_price'), '')::numeric AS price,
    NULL::jsonb AS opt_out_state_at_send,
    pay.id AS run_id,
    'payroll_reminder_sms_log'::text AS source_table,
    false AS is_dry_run,
    pay.sent_at,
    pay.sent_at AS created_at,
    pay.sent_at AS updated_at,
    NULL::text AS row_delivery_status,
    NULL::timestamptz AS row_delivery_status_at,
    NULL::text AS row_delivery_error_code
  FROM public.payroll_reminder_sms_log pay
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pay.results->'clicksend_results', '[]'::jsonb))
    WITH ORDINALITY AS ord(m, ordinality)
  LEFT JOIN public.app_users au_pay
    ON public.normalize_phone_to_e164(au_pay.phone_number)
     = public.normalize_phone_to_e164(NULLIF(ord.m->>'to', ''))
  WHERE jsonb_typeof(pay.results) = 'object'
    AND jsonb_typeof(pay.results->'clicksend_results') = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM public.sms_message_log n
      WHERE n.run_id = pay.id
        AND n.source_table = 'payroll_reminder_sms_log'
        AND n.is_dry_run = false
    )

  UNION ALL

  SELECT
    public.sms_compat_uuid(ms.id::text || ':mass') AS id,
    NULL::uuid AS user_id,
    NULL::text AS phone_e164,
    'mass_sms'::text AS message_type,
    'marketing'::text AS category,
    NULL::text AS from_number,
    ms.message_preview AS body,
    NULL::text AS template_key,
    NULL::text AS provider_message_id,
    ms.status AS provider_status,
    ms.total_price AS price,
    NULL::jsonb AS opt_out_state_at_send,
    ms.id AS run_id,
    'mass_sms_log'::text AS source_table,
    false AS is_dry_run,
    ms.created_at AS sent_at,
    ms.created_at,
    ms.created_at AS updated_at,
    NULL::text AS row_delivery_status,
    NULL::timestamptz AS row_delivery_status_at,
    NULL::text AS row_delivery_error_code
  FROM public.mass_sms_log ms
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sms_message_log n
    WHERE n.run_id = ms.id
      AND n.source_table = 'mass_sms_log'
      AND n.is_dry_run = false
  )
)
SELECT
  base.id,
  base.user_id,
  base.phone_e164,
  base.message_type,
  base.category,
  base.from_number,
  base.body,
  base.template_key,
  base.provider_message_id,
  base.provider_status,
  base.price,
  base.opt_out_state_at_send,
  base.run_id,
  base.source_table,
  base.is_dry_run,
  base.sent_at,
  base.created_at,
  base.updated_at,
  COALESCE(base.row_delivery_status, r.delivery_status) AS delivery_status,
  COALESCE(base.row_delivery_status_at, r.delivery_status_at) AS delivery_status_at,
  COALESCE(base.row_delivery_error_code, r.delivery_error_code) AS delivery_error_code,
  r.provider_status_text AS delivery_status_text
FROM base
LEFT JOIN public.sms_delivery_receipt r
  ON r.provider_message_id = base.provider_message_id;

COMMENT ON VIEW public.sms_message_log_compat IS
  'sms_message_log plus unnested pre-cutover rows from legacy log tables (escalation/payroll rows resolve user_id via normalized phone on app_users), with delivery receipts joined by provider_message_id. provider_status = submission; delivery_status = carrier outcome.';

GRANT SELECT ON public.sms_message_log_compat TO authenticated;
GRANT SELECT ON public.sms_message_log_compat TO service_role;

-- -----------------------------------------------------------------------------
-- 4. Kill switch + cron (created DISABLED, like every other SMS cron here)
-- -----------------------------------------------------------------------------

INSERT INTO public.app_settings (key, value) VALUES
(
  'sms_delivery_receipts_config',
  '{"enabled": true, "lookback_days": 7}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clicksend-delivery-receipts') THEN
      PERFORM cron.schedule(
        'clicksend-delivery-receipts',
        '30 9 * * *',
        $cron$
        SELECT net.http_post(
          url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/clicksend-delivery-receipts',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
          ),
          body := '{"apply": true}'::jsonb
        );
        $cron$
      );
      SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'clicksend-delivery-receipts';
      IF v_job_id IS NOT NULL THEN
        PERFORM cron.alter_job(v_job_id, active := false);
      END IF;
      RAISE NOTICE 'Scheduled clicksend-delivery-receipts (DISABLED). Run deploy-cron-auth.sh then enable via runbook.';
    ELSE
      RAISE NOTICE 'clicksend-delivery-receipts already exists; leaving unchanged.';
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping clicksend-delivery-receipts schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule clicksend-delivery-receipts: %', SQLERRM;
END;
$$;
