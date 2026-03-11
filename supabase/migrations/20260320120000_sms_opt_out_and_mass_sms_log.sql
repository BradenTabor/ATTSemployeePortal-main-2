-- =============================================================================
-- Mass SMS: opt-out column and audit log
-- - app_users.sms_marketing_opt_out: exclude from admin mass SMS when true
-- - mass_sms_log: one row per send run; status used for cooldown (completed only)
-- =============================================================================

-- Opt-out: when true, user is excluded from mass SMS (admin broadcast).
-- Safety/operational SMS (e.g. briefing reminders) may still be sent.
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS sms_marketing_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_users.sms_marketing_opt_out IS
  'When true, user is excluded from mass SMS (admin broadcast). Safety/operational SMS may still be sent.';

CREATE INDEX IF NOT EXISTS idx_app_users_sms_marketing_opt_out
  ON public.app_users(sms_marketing_opt_out)
  WHERE sms_marketing_opt_out = false;

-- Audit log: one row per send run. Cooldown checks status = 'completed' only.
CREATE TABLE IF NOT EXISTS public.mass_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  message_preview text,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  total_price numeric(12, 6) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  batch_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mass_sms_log IS
  'Audit log for admin mass SMS. One row per run. Cooldown (15 min) uses status = completed only.';
COMMENT ON COLUMN public.mass_sms_log.status IS 'completed = all batches sent; partial = some batches failed; failed = send aborted or all batches failed.';
COMMENT ON COLUMN public.mass_sms_log.batch_details IS 'Per-batch results: [{ "index": 0, "sent": 500, "failed": 0 }, ...].';

CREATE INDEX IF NOT EXISTS idx_mass_sms_log_created_at_status
  ON public.mass_sms_log(created_at DESC)
  WHERE status = 'completed';

ALTER TABLE public.mass_sms_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the log; only Edge Function (service role) inserts
DROP POLICY IF EXISTS "mass_sms_log_admin_select" ON public.mass_sms_log;
CREATE POLICY "mass_sms_log_admin_select"
  ON public.mass_sms_log FOR SELECT TO authenticated
  USING (public.is_admin());
