-- =============================================================================
-- Certification System — RLS Policies
-- =============================================================================
-- Uses app_users.user_id = auth.uid(). No direct SELECT on certification_questions.
-- =============================================================================

ALTER TABLE public.certification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_records ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- certification_types
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cert_types_select_active" ON public.certification_types;
CREATE POLICY "cert_types_select_active"
  ON public.certification_types FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "cert_types_admin_all" ON public.certification_types;
CREATE POLICY "cert_types_admin_all"
  ON public.certification_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- certification_questions — no direct access (fetch via RPC only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cert_questions_no_direct_select" ON public.certification_questions;
CREATE POLICY "cert_questions_no_direct_select"
  ON public.certification_questions FOR SELECT
  TO authenticated
  USING (false);

-- -----------------------------------------------------------------------------
-- certification_attempts
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cert_attempts_select_own" ON public.certification_attempts;
CREATE POLICY "cert_attempts_select_own"
  ON public.certification_attempts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cert_attempts_insert_own" ON public.certification_attempts;
CREATE POLICY "cert_attempts_insert_own"
  ON public.certification_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cert_attempts_update_in_progress_only" ON public.certification_attempts;
CREATE POLICY "cert_attempts_update_in_progress_only"
  ON public.certification_attempts FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status = 'in_progress'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'in_progress'
  );

-- -----------------------------------------------------------------------------
-- practical_evaluation_templates — authenticated read (for evaluator UI)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "practical_templates_select" ON public.practical_evaluation_templates;
CREATE POLICY "practical_templates_select"
  ON public.practical_evaluation_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "practical_templates_admin_all" ON public.practical_evaluation_templates;
CREATE POLICY "practical_templates_admin_all"
  ON public.practical_evaluation_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- practical_evaluations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "practical_eval_insert_evaluator" ON public.practical_evaluations;
CREATE POLICY "practical_eval_insert_evaluator"
  ON public.practical_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role IN ('admin', 'general_foreman')
    )
  );

DROP POLICY IF EXISTS "practical_eval_select_own_or_evaluator_or_admin" ON public.practical_evaluations;
CREATE POLICY "practical_eval_select_own_or_evaluator_or_admin"
  ON public.practical_evaluations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR evaluator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- certification_records
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cert_records_select_own_or_admin_gf" ON public.certification_records;
CREATE POLICY "cert_records_select_own_or_admin_gf"
  ON public.certification_records FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role IN ('admin', 'general_foreman')
    )
  );

DROP POLICY IF EXISTS "cert_records_insert_admin_only" ON public.certification_records;
CREATE POLICY "cert_records_insert_admin_only"
  ON public.certification_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cert_records_update_admin_only" ON public.certification_records;
CREATE POLICY "cert_records_update_admin_only"
  ON public.certification_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );
