-- =============================================================================
-- Points System v2 — Phase 1 read-cutover (Phase D)
-- Make get_user_point_balance the single source of truth.
--
-- get_user_total_points historically summed announcement_rewards.points_awarded
-- only, ignoring compliance points. The app has been repointed at
-- get_user_point_balance (the ledger). To guarantee any missed/legacy caller
-- still gets the correct number, redefine get_user_total_points as a THIN ALIAS
-- that delegates to get_user_point_balance.
--
-- DEPRECATED: scheduled for removal in a later increment. Do NOT add new callers.
-- This is a read-only change: it does not write to or alter the ledger.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_total_points(target_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- DEPRECATED alias: delegates to the ledger balance (single source of truth).
  SELECT public.get_user_point_balance(target_user_id);
$$;

-- Preserve the existing execute grant (REPLACE keeps owner/ACL, re-affirm anyway).
GRANT EXECUTE ON FUNCTION public.get_user_total_points(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_user_total_points(uuid) IS
  'DEPRECATED (remove in a later increment): thin alias for get_user_point_balance(). '
  'Originally summed announcement_rewards only; now delegates to the points ledger so '
  'every caller sees the same total. Do not add new callers.';
