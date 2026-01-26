-- =============================================================================
-- Practical Evaluation — Evaluator Authorization
-- =============================================================================
-- can_evaluate_user: admin -> anyone; general_foreman -> anyone except self.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_evaluate_user(
  p_evaluator_id UUID,
  p_evaluatee_id UUID,
  p_cert_type_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_evaluator_id IS NULL OR p_evaluatee_id IS NULL OR p_cert_type_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.app_users
  WHERE app_users.user_id = p_evaluator_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_role = 'general_foreman' THEN
    IF p_evaluator_id = p_evaluatee_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_evaluate_user(UUID, UUID, UUID) IS
  'Whether evaluator can evaluate evaluatee for given cert. Admin: anyone. GF: anyone except self.';

GRANT EXECUTE ON FUNCTION public.can_evaluate_user(UUID, UUID, UUID) TO authenticated;
