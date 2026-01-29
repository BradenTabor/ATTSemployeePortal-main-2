/*
  Weekly Safety Audit Report — storage for each weekly run.

  - weekly_safety_reports: one row per Friday 5 PM CST run (report_data = full metrics jsonb).
  - RLS: service role for cron; optional admin SELECT for dashboard.
*/

CREATE TABLE IF NOT EXISTS public.weekly_safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  report_data jsonb NOT NULL,
  email_sent boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  sheets_updated boolean NOT NULL DEFAULT false,
  sheets_updated_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_safety_reports_week_start
  ON public.weekly_safety_reports(week_start_date DESC);

COMMENT ON TABLE public.weekly_safety_reports IS
  'Audit log of weekly safety audit report runs. One row per Friday 5 PM CST execution.';

ALTER TABLE public.weekly_safety_reports ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS for cron. Allow admins to view in dashboard.
DROP POLICY IF EXISTS "weekly_safety_reports_admin_select" ON public.weekly_safety_reports;
CREATE POLICY "weekly_safety_reports_admin_select"
  ON public.weekly_safety_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
