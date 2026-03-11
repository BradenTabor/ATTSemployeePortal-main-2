-- =============================================================================
-- Fix get_compliance_streaks consecutive-day grouping.
-- With ORDER BY date_for DESC, (date_for - ROW_NUMBER()) gives a different
-- value per row; (date_for + ROW_NUMBER()) groups consecutive dates correctly.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_compliance_streaks(
  p_user_ids uuid[],
  p_before_date date
)
RETURNS TABLE(user_id uuid, streak_days bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cr AS (
    SELECT cr2.user_id, cr2.date_for
    FROM public.compliance_rewards cr2
    WHERE cr2.user_id = ANY(p_user_ids)
      AND cr2.date_for < p_before_date
      AND array_length(cr2.forms_completed, 1) = 3
  ),
  ranked AS (
    SELECT
      user_id,
      date_for,
      (date_for + (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date_for DESC))::int) AS grp
    FROM cr
  ),
  streak AS (
    SELECT user_id, grp, COUNT(*)::bigint AS streak_days
    FROM ranked
    GROUP BY user_id, grp
  ),
  current_streak AS (
    SELECT s.user_id, s.streak_days
    FROM streak s
    JOIN ranked r ON r.user_id = s.user_id AND r.grp = s.grp
    WHERE r.date_for = p_before_date - 1
  )
  SELECT cs.user_id, cs.streak_days FROM current_streak cs;
$$;
