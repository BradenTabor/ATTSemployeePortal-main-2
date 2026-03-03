/*
  Allow Safety Officer and General Foreman to read compliance_runs and compliance_notifications
  so OverdueFormAlerts and SO dashboard can show non-compliant users.
  (is_admin_or_safety_or_gf created in 20260216600000_safety_flags.sql)
*/

-- compliance_runs: SO/GF can SELECT
DROP POLICY IF EXISTS "compliance_runs_so_gf_select" ON public.compliance_runs;
CREATE POLICY "compliance_runs_so_gf_select"
  ON public.compliance_runs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_safety_or_gf());

-- compliance_notifications: SO/GF can SELECT all (for dashboard overdue list)
DROP POLICY IF EXISTS "compliance_notifications_so_gf_select" ON public.compliance_notifications;
CREATE POLICY "compliance_notifications_so_gf_select"
  ON public.compliance_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_safety_or_gf());
