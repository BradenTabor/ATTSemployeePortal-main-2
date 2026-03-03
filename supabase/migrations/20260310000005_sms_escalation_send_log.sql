-- =============================================================================
-- SMS Escalation Send Log – idempotency, cost tracking, per-recipient debugging
-- Populated by safety-briefing-escalation-sms Edge Function after each send.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_escalation_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier integer NOT NULL CHECK (tier IN (1, 2)),
  date_checked date NOT NULL,
  overdue_count integer NOT NULL,
  recipient_count integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL,
  error_message text,
  total_price numeric(10, 4),
  results jsonb
);

COMMENT ON TABLE public.sms_escalation_send_log IS
  'Audit log of SMS escalation sends. Used for idempotency (skip if already sent for tier+date_checked today), cost visibility (total_price), and per-recipient status (results).';
COMMENT ON COLUMN public.sms_escalation_send_log.total_price IS 'From ClickSend response; cost visibility without dashboard.';
COMMENT ON COLUMN public.sms_escalation_send_log.results IS 'Per-message results array: { to, status, messageId } per recipient.';

CREATE INDEX IF NOT EXISTS idx_sms_escalation_send_log_tier_date
  ON public.sms_escalation_send_log(tier, date_checked);

CREATE INDEX IF NOT EXISTS idx_sms_escalation_send_log_sent_at
  ON public.sms_escalation_send_log(sent_at DESC);

ALTER TABLE public.sms_escalation_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_escalation_send_log_admin_select" ON public.sms_escalation_send_log;
CREATE POLICY "sms_escalation_send_log_admin_select"
  ON public.sms_escalation_send_log FOR SELECT TO authenticated
  USING (public.is_admin());
