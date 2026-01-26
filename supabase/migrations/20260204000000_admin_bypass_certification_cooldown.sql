-- =============================================================================
-- Allow admins to retake certification tests without 24-hour cooldown
-- =============================================================================

CREATE OR REPLACE FUNCTION public.can_start_certification_attempt(
  p_cert_type_id UUID,
  p_check_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  can_start BOOLEAN,
  reason TEXT,
  next_available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_attempt RECORD;
  cooldown_ends TIMESTAMPTZ;
BEGIN
  IF p_check_user_id IS NULL THEN
    can_start := false;
    reason := 'Not authenticated';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT public.user_has_certification_access(p_check_user_id, p_cert_type_id) THEN
    can_start := false;
    reason := 'You do not have access to this certification. Contact an administrator.';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Admins bypass the 24-hour cooldown and can retake at any time
  IF EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = p_check_user_id AND role = 'admin'
  ) THEN
    can_start := true;
    reason := 'Admin: cooldown does not apply';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT ca.*
  INTO last_attempt
  FROM public.certification_attempts ca
  WHERE ca.user_id = p_check_user_id
    AND ca.certification_type_id = p_cert_type_id
    AND ca.status = 'graded'
  ORDER BY ca.completed_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    can_start := true;
    reason := 'No previous attempts';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF last_attempt.passed THEN
    can_start := true;
    reason := 'Previous attempt passed';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  cooldown_ends := last_attempt.completed_at + INTERVAL '24 hours';
  IF now() < cooldown_ends THEN
    can_start := false;
    reason := 'Must wait 24 hours after failed attempt';
    next_available_at := cooldown_ends;
    RETURN NEXT;
    RETURN;
  END IF;

  can_start := true;
  reason := 'Cooldown period passed';
  next_available_at := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.can_start_certification_attempt(UUID, UUID) IS
  'Check if user can start a new attempt. 24h cooldown after failure; admins bypass cooldown.';
