-- =============================================================================
-- SMS Escalation Recipients – contact list for safety briefing overdue alerts
-- Used by safety-briefing-escalation-sms Edge Function (ClickSend).
-- Tier 1 ≈ 1 business day overdue; tier 2 ≈ 2 business days overdue.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_escalation_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier integer NOT NULL CHECK (tier IN (1, 2)),
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9]\d{6,14}$'),
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_escalation_recipients IS
  'Admin-managed SMS recipients for safety briefing overdue escalation. Tier 1 = 1-day overdue; tier 2 = 2-day. Code sends to all active recipients in each tier.';
COMMENT ON COLUMN public.sms_escalation_recipients.tier IS '1 = 1 business day overdue escalation; 2 = 2 business days overdue.';
COMMENT ON COLUMN public.sms_escalation_recipients.phone_e164 IS 'E.164 format for ClickSend (e.g. +15551234567).';
COMMENT ON COLUMN public.sms_escalation_recipients.is_active IS 'When false, exclude from sends (e.g. vacation); do not delete.';

CREATE INDEX IF NOT EXISTS idx_sms_escalation_recipients_tier_active
  ON public.sms_escalation_recipients(tier, is_active)
  WHERE is_active = true;

ALTER TABLE public.sms_escalation_recipients ENABLE ROW LEVEL SECURITY;

-- Only admins can manage; Edge Function uses service role
DROP POLICY IF EXISTS "sms_escalation_recipients_admin_select" ON public.sms_escalation_recipients;
CREATE POLICY "sms_escalation_recipients_admin_select"
  ON public.sms_escalation_recipients FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "sms_escalation_recipients_admin_insert" ON public.sms_escalation_recipients;
CREATE POLICY "sms_escalation_recipients_admin_insert"
  ON public.sms_escalation_recipients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sms_escalation_recipients_admin_update" ON public.sms_escalation_recipients;
CREATE POLICY "sms_escalation_recipients_admin_update"
  ON public.sms_escalation_recipients FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sms_escalation_recipients_admin_delete" ON public.sms_escalation_recipients;
CREATE POLICY "sms_escalation_recipients_admin_delete"
  ON public.sms_escalation_recipients FOR DELETE TO authenticated
  USING (public.is_admin());
