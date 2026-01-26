-- =============================================================================
-- Fix schema cache: allow_all_users column + grant_certification_access function
-- Run this in Supabase SQL Editor if migrations weren't applied in order.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- 1. Add allow_all_users column if missing (e.g. 20260203000000 not applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'certification_types'
      AND column_name = 'allow_all_users'
  ) THEN
    ALTER TABLE public.certification_types
      ADD COLUMN allow_all_users BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.certification_types.allow_all_users IS
      'When true, all authenticated users can access this certification and its study guide.';
  END IF;
END $$;

-- 2. Ensure user_has_certification_access uses allow_all_users (if column exists)
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

-- 3. Create grant_certification_access with explicit parameter order: (p_user_id, p_certification_type_id)
--    PostgREST/Supabase match RPC by param names; ensuring this exists fixes schema cache.
DROP FUNCTION IF EXISTS public.grant_certification_access(UUID, UUID);

CREATE FUNCTION public.grant_certification_access(
  p_user_id UUID,
  p_certification_type_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can grant certification access';
  END IF;

  INSERT INTO public.certification_access_grants (
    user_id,
    certification_type_id,
    granted_by,
    granted_at
  ) VALUES (
    p_user_id,
    p_certification_type_id,
    auth.uid(),
    now()
  )
  ON CONFLICT (user_id, certification_type_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.grant_certification_access(UUID, UUID) IS
  'Admin only: grant a user access to a certification test and study guide.';

GRANT EXECUTE ON FUNCTION public.grant_certification_access(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_certification_access(UUID, UUID) TO service_role;
