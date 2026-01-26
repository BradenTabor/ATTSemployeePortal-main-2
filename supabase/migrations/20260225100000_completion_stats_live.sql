-- =============================================================================
-- Completion stats: read live from certification_attempts so admin sees
-- up-to-date counts without waiting for mat view refresh.
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_certification_completion_stats();

CREATE OR REPLACE FUNCTION public.get_certification_completion_stats()
RETURNS TABLE (
  certification_type_id uuid,
  certification_name text,
  total_attempts bigint,
  passed_users bigint,
  avg_passing_score numeric,
  avg_attempts_to_pass numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ct.id,
    ct.name,
    COUNT(ca.id) FILTER (WHERE ca.status = 'graded') AS total_attempts,
    COUNT(ca.id) FILTER (WHERE ca.status = 'graded' AND ca.passed = true) AS passed_users,
    ROUND(AVG(ca.score_percentage) FILTER (WHERE ca.status = 'graded' AND ca.passed = true)::numeric, 2) AS avg_passing_score,
    ROUND(AVG(ca.attempt_number) FILTER (WHERE ca.status = 'graded' AND ca.passed = true)::numeric, 2) AS avg_attempts_to_pass
  FROM public.certification_types ct
  LEFT JOIN public.certification_attempts ca ON ct.id = ca.certification_type_id
  WHERE ct.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  GROUP BY ct.id, ct.name;
$$;

COMMENT ON FUNCTION public.get_certification_completion_stats() IS
  'Live per-cert completion stats for admin. Replaces read from materialized view so stats update immediately after tests are graded.';
