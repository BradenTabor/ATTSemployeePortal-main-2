-- =============================================================================
-- Compliance rewards: add streak_min_days to existing config and create
-- get_compliance_streaks RPC for batch streak calculation (one query for all users).
-- =============================================================================

-- Ensure reward_points_config has streak_min_days (for DBs where seed already ran)
UPDATE public.app_settings
SET value = value || '{"streak_min_days": 5}'::jsonb
WHERE key = 'reward_points_config'
  AND (value->>'streak_min_days') IS NULL;

-- =============================================================================
-- RPC: get_compliance_streaks(user_ids, before_date)
-- Returns (user_id, streak_days) for users who have consecutive full-compliance
-- days ending the day before before_date. One query for all users (batch).
-- Full compliance = array_length(forms_completed, 1) = 3.
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

COMMENT ON FUNCTION public.get_compliance_streaks(uuid[], date) IS
  'Returns consecutive full-compliance streak (days) ending the day before p_before_date, for each user in p_user_ids. Used by admin-compliance-cron for batch streak bonus.';

GRANT EXECUTE ON FUNCTION public.get_compliance_streaks(uuid[], date) TO service_role;
