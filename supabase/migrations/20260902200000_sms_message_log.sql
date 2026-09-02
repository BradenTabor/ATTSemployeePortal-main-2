-- =============================================================================
-- Unified per-recipient SMS log (Chunk 1). Additive: no DROP/ALTER of legacy
-- sms_escalation_send_log, mass_sms_log, or payroll_reminder_sms_log.
-- Compat view unions unnested legacy rows that do not yet have a live run_id.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  phone_e164 text,
  message_type text NOT NULL,
  category text NOT NULL CHECK (category IN ('operational', 'marketing')),
  from_number text,
  body text,
  template_key text,
  provider_message_id text,
  provider_status text,
  price numeric(12, 6),
  opt_out_state_at_send jsonb,
  run_id uuid,
  source_table text,
  is_dry_run boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_message_log IS
  'One row per recipient per SMS send (live or dry-run). Chunk 1 of the SMS pipeline upgrade.';
COMMENT ON COLUMN public.sms_message_log.user_id IS
  'auth.users id when known; null for static sms_escalation_recipients.';
COMMENT ON COLUMN public.sms_message_log.phone_e164 IS
  'Destination E.164. Null only on pre-cutover mass_sms_log rows in the compat view.';
COMMENT ON COLUMN public.sms_message_log.opt_out_state_at_send IS
  'Snapshot { "operational": bool, "marketing": bool } at send time.';
COMMENT ON COLUMN public.sms_message_log.run_id IS
  'Legacy per-run log id (sms_escalation_send_log / mass_sms_log / payroll_reminder_sms_log). No FK — three source tables.';
COMMENT ON COLUMN public.sms_message_log.is_dry_run IS
  'true = wrapper skipped ClickSend POST. Exclude from compliance exports.';

CREATE INDEX IF NOT EXISTS idx_sms_message_log_sent_at
  ON public.sms_message_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_message_log_user_id
  ON public.sms_message_log (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_message_log_run
  ON public.sms_message_log (run_id, source_table)
  WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sms_message_log_type
  ON public.sms_message_log (message_type);
CREATE INDEX IF NOT EXISTS idx_sms_message_log_dry_run
  ON public.sms_message_log (is_dry_run);

ALTER TABLE public.sms_message_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_message_log_admin_select" ON public.sms_message_log;
CREATE POLICY "sms_message_log_admin_select"
  ON public.sms_message_log FOR SELECT TO authenticated
  USING (public.is_admin());

DROP TRIGGER IF EXISTS set_sms_message_log_updated_at ON public.sms_message_log;
CREATE TRIGGER set_sms_message_log_updated_at
  BEFORE UPDATE ON public.sms_message_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.sms_message_log TO authenticated;
GRANT ALL ON public.sms_message_log TO service_role;

-- Deterministic uuid from text (compat view ids must be stable across queries).
CREATE OR REPLACE FUNCTION public.sms_compat_uuid(p_seed text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CAST(CAST(('x' || md5(p_seed)) AS bit(128)) AS uuid);
$$;

CREATE OR REPLACE VIEW public.sms_message_log_compat
WITH (security_invoker = true) AS
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
  l.updated_at
FROM public.sms_message_log l

UNION ALL

SELECT
  public.sms_compat_uuid(esc.id::text || ':esc:' || ord.ordinality::text) AS id,
  NULL::uuid AS user_id,
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
  esc.sent_at AS updated_at
FROM public.sms_escalation_send_log esc
CROSS JOIN LATERAL jsonb_array_elements(esc.results) WITH ORDINALITY AS ord(m, ordinality)
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
  NULL::uuid AS user_id,
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
  pay.sent_at AS updated_at
FROM public.payroll_reminder_sms_log pay
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pay.results->'clicksend_results', '[]'::jsonb))
  WITH ORDINALITY AS ord(m, ordinality)
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
  ms.created_at AS updated_at
FROM public.mass_sms_log ms
WHERE NOT EXISTS (
  SELECT 1
  FROM public.sms_message_log n
  WHERE n.run_id = ms.id
    AND n.source_table = 'mass_sms_log'
    AND n.is_dry_run = false
);

COMMENT ON VIEW public.sms_message_log_compat IS
  'sms_message_log plus unnested pre-cutover rows from sms_escalation_send_log, payroll_reminder_sms_log, and mass_sms_log. Mass history is run-level (no per-recipient data existed).';

GRANT SELECT ON public.sms_message_log_compat TO authenticated;
GRANT SELECT ON public.sms_message_log_compat TO service_role;
