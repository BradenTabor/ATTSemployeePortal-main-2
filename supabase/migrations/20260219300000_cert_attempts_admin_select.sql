-- Allow admins to SELECT all certification_attempts for Reports (pass rate, time-to-grade).
-- Existing cert_attempts_select_own remains for users to see their own attempts.

CREATE POLICY "cert_attempts_select_admin"
  ON public.certification_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

COMMENT ON POLICY "cert_attempts_select_admin" ON public.certification_attempts IS
  'Admins can read all attempts for certification reports (pass rate, time-to-grade).';
