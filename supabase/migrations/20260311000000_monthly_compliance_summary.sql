-- =============================================================================
-- Monthly Compliance Summary: recipient list and send log
-- Used by monthly-compliance-summary Edge Function (1st of each month, 8 AM CST).
-- Privacy: only add HR/safety leadership to monthly_summary_recipients; Section 4
-- (Repeat Offenders) contains individual employee names and miss counts.
-- =============================================================================

-- Recipient list (separate from SMS escalation recipients)
CREATE TABLE IF NOT EXISTS public.monthly_summary_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.monthly_summary_recipients IS
  'Email recipients for the monthly safety compliance executive summary. Admin-only RLS. Only add authorized HR, safety directors, and executive management.';

ALTER TABLE public.monthly_summary_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_summary_recipients_admin_only" ON public.monthly_summary_recipients;
CREATE POLICY "monthly_summary_recipients_admin_only"
  ON public.monthly_summary_recipients
  FOR ALL
  USING (public.is_admin());

-- Log of sent summaries (idempotency + audit); report_html allows retry to skip recomputation on email failure
CREATE TABLE IF NOT EXISTS public.monthly_summary_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_label text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_count int,
  overall_compliance_rate numeric(5,2),
  total_sms_sent int,
  total_sms_cost numeric(10,2),
  report_html text,
  success boolean NOT NULL DEFAULT true,
  error_message text
);

COMMENT ON TABLE public.monthly_summary_send_log IS
  'Audit log for monthly compliance summary emails. Unique on month_label WHERE success = true prevents duplicate sends.';
COMMENT ON COLUMN public.monthly_summary_send_log.report_html IS
  'Generated HTML body; stored even on failure so manual retry with ?month= can optionally skip recomputation.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_summary_send_log_month_success
  ON public.monthly_summary_send_log(month_label)
  WHERE success = true;

CREATE INDEX IF NOT EXISTS idx_monthly_summary_send_log_sent_at
  ON public.monthly_summary_send_log(sent_at DESC);

-- pg_cron: 1st of every month at 14:00 UTC (8 AM CST)
-- IMPORTANT: Run scripts/deploy-cron-auth.sh to set the real Authorization (Bearer) key.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-compliance-summary') THEN
    PERFORM cron.schedule(
      'monthly-compliance-summary',
      '0 14 1 * *',
      $cron$
      SELECT net.http_post(
        url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/monthly-compliance-summary',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer SERVICE_ROLE_KEY_PLACEHOLDER'
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    RAISE NOTICE 'Scheduled monthly-compliance-summary. Run deploy-cron-auth.sh to set real auth key.';
  ELSE
    RAISE NOTICE 'monthly-compliance-summary already exists; leaving unchanged.';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping monthly-compliance-summary schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule monthly-compliance-summary: %', SQLERRM;
END;
$$;
