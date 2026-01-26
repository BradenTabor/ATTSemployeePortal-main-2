-- Fix: grant_certification_access must use SECURITY INVOKER so the INSERT runs
-- as the caller (admin). With SECURITY DEFINER, RLS on certification_access_grants
-- can block the insert because the definer role may not match auth.uid().
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.grant_certification_access(
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
  'Admin only: grant a user access to a certification test and study guide. Uses SECURITY INVOKER so RLS allows the insert.';
