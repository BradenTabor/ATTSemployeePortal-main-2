-- =============================================================================
-- Payroll hours reminder SMS (Thu–Sat 8 AM Central)
-- - sms_operational_opt_out on app_users
-- - payroll_reminder_sms_log with crash-recoverable idempotency
-- - claim_payroll_reminder_sms_log RPC
-- - pg_cron: payroll-hours-reminder-sms-utc13 / utc14
-- =============================================================================

-- 1. Operational SMS opt-out (distinct from sms_marketing_opt_out)
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS sms_operational_opt_out boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_users.sms_operational_opt_out IS
  'When true, exclude from operational SMS (payroll reminders, etc.). Distinct from sms_marketing_opt_out.';

-- 2. Audit / idempotency log
CREATE TABLE IF NOT EXISTS public.payroll_reminder_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier integer NOT NULL CHECK (tier IN (1, 2, 3)),
  date_checked date NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  error_message text,
  total_price numeric(10, 4),
  employee_user_ids uuid[] NOT NULL DEFAULT '{}',
  results jsonb
);

COMMENT ON TABLE public.payroll_reminder_sms_log IS
  'Audit log for payroll hours reminder SMS (Thu=1, Fri=2, Sat=3).';

-- Unique (date_checked, tier) enables idempotent sends. ON CONFLICT DO UPDATE in
-- claim_payroll_reminder_sms_log reclaims rows where success=false and sent_at
-- is older than 15 minutes so a mid-run crash does not block retries that day.
-- Rows with success=true are never updated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_reminder_sms_log_date_tier
  ON public.payroll_reminder_sms_log (date_checked, tier);

CREATE INDEX IF NOT EXISTS idx_payroll_reminder_sms_log_sent_at
  ON public.payroll_reminder_sms_log (sent_at DESC);

ALTER TABLE public.payroll_reminder_sms_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_reminder_sms_log_admin_select" ON public.payroll_reminder_sms_log;
CREATE POLICY "payroll_reminder_sms_log_admin_select"
  ON public.payroll_reminder_sms_log FOR SELECT TO authenticated
  USING (public.is_admin());

-- 3. Claim send slot (crash recovery + concurrency guard)
CREATE OR REPLACE FUNCTION public.claim_payroll_reminder_sms_log(
  p_date_checked date,
  p_tier integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_tier NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Invalid tier %', p_tier;
  END IF;

  INSERT INTO public.payroll_reminder_sms_log (
    date_checked,
    tier,
    recipient_count,
    success,
    employee_user_ids,
    results
  )
  VALUES (
    p_date_checked,
    p_tier,
    0,
    false,
    '{}',
    '{"status":"in_progress"}'::jsonb
  )
  ON CONFLICT (date_checked, tier) DO UPDATE
    SET sent_at = now()
    WHERE payroll_reminder_sms_log.success = false
      AND payroll_reminder_sms_log.sent_at < now() - interval '15 minutes'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.claim_payroll_reminder_sms_log IS
  'Claims idempotent payroll SMS send slot for date+tier. Returns NULL if already completed or in-progress (<15 min).';

GRANT EXECUTE ON FUNCTION public.claim_payroll_reminder_sms_log(date, integer) TO service_role;

-- 4. Optional phone re-normalize (run prod diagnostic first; safe idempotent UPDATE)
UPDATE public.app_users
SET phone_number = normalized.phone_e164
FROM (
  SELECT
    id,
    CASE
      WHEN digits.len = 10 THEN '+1' || digits.d
      WHEN digits.len = 11 AND left(digits.d, 1) = '1' THEN '+' || digits.d
      WHEN digits.len BETWEEN 7 AND 15 THEN '+' || digits.d
      ELSE NULL
    END AS phone_e164
  FROM (
    SELECT
      id,
      regexp_replace(trim(COALESCE(phone_number, '')), '\D', '', 'g') AS d,
      length(regexp_replace(trim(COALESCE(phone_number, '')), '\D', '', 'g')) AS len
    FROM public.app_users
    WHERE phone_number IS NOT NULL AND trim(phone_number) <> ''
      AND phone_number !~ '^\+?[0-9]{10,15}$'
  ) digits
  WHERE digits.len BETWEEN 7 AND 15
) normalized
WHERE public.app_users.id = normalized.id
  AND normalized.phone_e164 IS NOT NULL
  AND normalized.phone_e164 ~ '^\+[1-9]\d{6,14}$'
  AND (public.app_users.phone_number IS DISTINCT FROM normalized.phone_e164);

-- 5. app_settings kill switch
INSERT INTO public.app_settings (key, value)
VALUES (
  'payroll_reminder_sms_config',
  '{"enabled": true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 6. pg_cron — dual UTC slots; edge function wall-clock guard picks 8 AM CT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payroll-hours-reminder-sms-utc14') THEN
    PERFORM cron.schedule(
      'payroll-hours-reminder-sms-utc14',
      '0 14 * * 4,5,6',
      $cron$
      SELECT net.http_post(
        url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/payroll-hours-reminder-sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
        ),
        body := '{"dryRun":false}'::jsonb
      );
      $cron$
    );
    RAISE NOTICE 'Scheduled payroll-hours-reminder-sms-utc14. Run deploy-cron-auth.sh for Bearer key.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payroll-hours-reminder-sms-utc13') THEN
    PERFORM cron.schedule(
      'payroll-hours-reminder-sms-utc13',
      '0 13 * * 4,5,6',
      $cron$
      SELECT net.http_post(
        url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/payroll-hours-reminder-sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
        ),
        body := '{"dryRun":false}'::jsonb
      );
      $cron$
    );
    RAISE NOTICE 'Scheduled payroll-hours-reminder-sms-utc13. Run deploy-cron-auth.sh for Bearer key.';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping payroll reminder SMS schedules.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule payroll reminder SMS: %', SQLERRM;
END;
$$;
