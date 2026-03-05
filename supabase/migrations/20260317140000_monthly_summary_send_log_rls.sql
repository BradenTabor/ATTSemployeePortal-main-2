-- Enable RLS on monthly_summary_send_log (omitted from original migration).
-- Edge functions write via service role key (bypasses RLS); admin reads via policy.

ALTER TABLE public.monthly_summary_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read send log"
  ON public.monthly_summary_send_log
  FOR SELECT
  USING (public.is_admin());
