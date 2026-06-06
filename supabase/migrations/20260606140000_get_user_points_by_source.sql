-- =============================================================================
-- Points System v2 — My Points page: aggregated ledger breakdown by source/category
-- SECURITY DEFINER with self-or-admin scoping (non-admins always get own rows only).
-- Sum of totals reconciles to get_user_point_balance for the same user.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_user_points_by_source(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(source public.point_source, category text, total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user uuid;
BEGIN
  IF target_user_id IS NULL THEN
    v_effective_user := auth.uid();
  ELSIF public.is_admin() OR target_user_id = auth.uid() THEN
    v_effective_user := target_user_id;
  ELSE
    RAISE EXCEPTION 'Not permitted to view points for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pt.source,
    pt.category,
    COALESCE(SUM(pt.amount), 0)::integer AS total
  FROM public.point_transactions pt
  WHERE pt.user_id = v_effective_user
  GROUP BY pt.source, pt.category
  ORDER BY pt.source, pt.category NULLS FIRST;
END;
$$;

COMMENT ON FUNCTION public.get_user_points_by_source(uuid) IS
  'Returns SUM(amount) grouped by source and category for a user. '
  'Non-admins may only query their own data; admins may query any user.';

GRANT EXECUTE ON FUNCTION public.get_user_points_by_source(uuid) TO authenticated;
