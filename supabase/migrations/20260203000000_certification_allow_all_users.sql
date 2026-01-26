-- =============================================================================
-- Certification access: restricted by default, allow "all users" toggle
-- =============================================================================
-- Certifications and study guides are restricted to all users except admins
-- at all times. If no one is granted access, only admins have access.
-- Admins can "Grant access to all users" or "Revoke access from all users
-- (except admins)" per certification.
-- =============================================================================

-- Add column to certification_types (admins-only UPDATE already exists)
ALTER TABLE public.certification_types
  ADD COLUMN IF NOT EXISTS allow_all_users BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.certification_types.allow_all_users IS
  'When true, all authenticated users can access this certification and its study guide. When false, only admins and individually granted users can access.';

-- Update helper: non-admins need allow_all_users OR a personal grant
CREATE OR REPLACE FUNCTION public.user_has_certification_access(
  p_user_id UUID,
  p_certification_type_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_allow_all BOOLEAN;
  v_has_user_grant BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_certification_type_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  SELECT COALESCE(ct.allow_all_users, false) INTO v_allow_all
  FROM public.certification_types ct
  WHERE ct.id = p_certification_type_id AND ct.is_active = true;

  IF v_allow_all THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.certification_access_grants
    WHERE certification_type_id = p_certification_type_id
      AND user_id = p_user_id
  ) INTO v_has_user_grant;

  RETURN v_has_user_grant;
END;
$$;

COMMENT ON FUNCTION public.user_has_certification_access(UUID, UUID) IS
  'True if user may access this certification (test + study guide). Admins always; others only if allow_all_users or has a grant.';
