-- =============================================================================
-- Gamification Phase 2 — Gate 4: player-facing season standings RPC
-- Thin bulk read for SeasonStandingsPanel (Track A top eligible only).
-- Separate from Gate 4 frontend — apply with full drift/gate discipline if prod-needed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_gamification_season_standings(
  p_season_key text,
  p_limit      int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.are_seasons_enabled() THEN
    RETURN '[]'::jsonb;
  END IF;

  IF p_season_key IS NULL OR btrim(p_season_key) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY (row_data->>'season_score')::int DESC, row_data->>'user_id')
      FROM (
        SELECT jsonb_build_object(
          'user_id', ranked.user_id,
          'full_name', au.full_name,
          'avatar_url', au.avatar_url,
          'season_score', ranked.season_score,
          'tier_key', gl.tier_key,
          'tier_name', gl.tier_name,
          'tier_order', gl.tier_order,
          'sub_level', gl.sub_level,
          'sub_level_label', gl.sub_level_label
        ) AS row_data
        FROM (
          SELECT
            eligible.user_id,
            public.get_user_season_score(eligible.user_id, p_season_key) AS season_score
          FROM public.app_users eligible
          WHERE public.is_competition_eligible(eligible.user_id)
        ) ranked
        JOIN public.app_users au ON au.user_id = ranked.user_id
        JOIN LATERAL public.get_user_level(ranked.user_id) gl ON true
        WHERE ranked.season_score > 0
        ORDER BY ranked.season_score DESC, ranked.user_id ASC
        LIMIT v_limit
      ) top_rows
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.get_gamification_season_standings(text, int) IS
  'Player-facing top season standings (Track A). Eligible field roles only; capped at 25. Returns [] when seasons flag off.';

GRANT EXECUTE ON FUNCTION public.get_gamification_season_standings(text, int) TO authenticated;
