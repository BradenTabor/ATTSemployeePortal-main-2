-- =============================================================================
-- abandon_certification_attempt RPC
-- =============================================================================
-- Allow users to abandon their in-progress attempt. RLS blocks direct UPDATE
-- when changing status from in_progress to abandoned (WITH CHECK requires
-- status = 'in_progress'). This SECURITY DEFINER RPC performs the update.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.abandon_certification_attempt(p_attempt_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.certification_attempts
  SET status = 'abandoned'
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Attempt not found, already abandoned, or not owned by you';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.abandon_certification_attempt(UUID) IS
  'Abandon own in-progress attempt. Used by Start fresh flow.';

GRANT EXECUTE ON FUNCTION public.abandon_certification_attempt(UUID) TO authenticated;
