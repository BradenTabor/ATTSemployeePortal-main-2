-- =============================================================================
-- Reward claim window: respect override_dates from app_settings.reward_points_config
-- When today (America/Chicago) is in override_dates, the claim window is open all day.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (
        -- Override: today's date (Chicago) in override_dates array => window open
        (s.value->'override_dates') ? ((NOW() AT TIME ZONE 'America/Chicago')::date::text)
        OR (
          -- Otherwise: within configured start/end hour
          (NOW() AT TIME ZONE 'America/Chicago')::time
            >= make_time((s.value->>'claim_window_start_hour_central')::int, 0, 0)
          AND (NOW() AT TIME ZONE 'America/Chicago')::time
            < make_time((s.value->>'claim_window_end_hour_central')::int, 0, 0)
        )
      )
      FROM public.app_settings s
      WHERE s.key = 'reward_points_config'
      LIMIT 1
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true when (1) current Chicago date is in reward_points_config.override_dates, or (2) current Chicago time is within claim_window_start/end_hour_central from app_settings. Falls back to false if row is missing.';
