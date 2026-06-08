-- =============================================================================
-- Gamification Phase 1 — Gate 5: player-facing profile + standings RPCs
-- Public rank card and top standings (eligible field roles only).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION: get_gamification_standings — top earners, no bottom ranks
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gamification_standings(
  p_limit int DEFAULT 25
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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY (row_data->>'lifetime_earned')::int DESC, row_data->>'user_id')
      FROM (
        SELECT jsonb_build_object(
          'user_id', au.user_id,
          'full_name', au.full_name,
          'avatar_url', au.avatar_url,
          'lifetime_earned', gl.lifetime_earned,
          'tier_key', gl.tier_key,
          'tier_name', gl.tier_name,
          'tier_order', gl.tier_order,
          'sub_level', gl.sub_level,
          'sub_level_label', gl.sub_level_label,
          'current_streak_weeks', COALESCE(ss.current_streak_weeks, 0),
          'longest_streak', COALESCE(ss.longest_streak, 0)
        ) AS row_data
        FROM public.app_users au
        JOIN LATERAL public.get_user_level(au.user_id) gl ON true
        LEFT JOIN public.streak_state ss ON ss.user_id = au.user_id
        WHERE public.is_competition_eligible(au.user_id)
        ORDER BY gl.lifetime_earned DESC, au.user_id
        LIMIT v_limit
      ) ranked
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.get_gamification_standings(int) IS
  'Player-facing top standings by lifetime earned. Eligible field roles only; capped at 50.';

GRANT EXECUTE ON FUNCTION public.get_gamification_standings(int) TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: get_public_gamification_profile — rank card for any eligible user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_gamification_profile(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user record;
  v_level record;
  v_badges jsonb;
  v_eligible boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_eligible := public.is_competition_eligible(p_user_id)
    OR p_user_id = auth.uid();

  IF NOT v_eligible THEN
    RETURN jsonb_build_object(
      'user_id', p_user_id,
      'eligible', false
    );
  END IF;

  SELECT au.user_id, au.full_name, au.avatar_url, au.hire_date
  INTO v_user
  FROM public.app_users au
  WHERE au.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_level FROM public.get_user_level(p_user_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'badge_key', ub.badge_key,
        'title', b.title,
        'category', b.category,
        'prestige_tier', ub.prestige_tier,
        'prestige_max', b.prestige_max,
        'awarded_at', ub.awarded_at,
        'sort_order', b.sort_order
      )
      ORDER BY b.sort_order, ub.prestige_tier DESC
    ),
    '[]'::jsonb
  )
  INTO v_badges
  FROM public.user_badges ub
  JOIN public.badges b ON b.badge_key = ub.badge_key AND b.is_active
  WHERE ub.user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', v_user.user_id,
    'eligible', true,
    'full_name', v_user.full_name,
    'avatar_url', v_user.avatar_url,
    'hire_date', v_user.hire_date,
    'level', jsonb_build_object(
      'tier_key', v_level.tier_key,
      'tier_name', v_level.tier_name,
      'tier_order', v_level.tier_order,
      'sub_level', v_level.sub_level,
      'sub_level_label', v_level.sub_level_label,
      'lifetime_earned', v_level.lifetime_earned,
      'current_threshold', v_level.current_threshold,
      'next_threshold', v_level.next_threshold,
      'progress_pct', v_level.progress_pct
    ),
    'weekly_streak', (
      SELECT jsonb_build_object(
        'current_streak_weeks', COALESCE(ss.current_streak_weeks, 0),
        'longest_streak', COALESCE(ss.longest_streak, 0),
        'freezes_remaining', COALESCE(ss.freezes_remaining, 0)
      )
      FROM public.streak_state ss
      WHERE ss.user_id = p_user_id
    ),
    'badges', v_badges
  );
END;
$$;

COMMENT ON FUNCTION public.get_public_gamification_profile(uuid) IS
  'Public gamification rank card: level, weekly streak, badges. Eligible users or self.';

GRANT EXECUTE ON FUNCTION public.get_public_gamification_profile(uuid) TO authenticated;
