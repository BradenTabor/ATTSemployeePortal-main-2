-- =============================================================================
-- Gamification Phase 1 — Gate 2: badge engine + starter badges
-- - award_badge (idempotent), evaluate_user_badges
-- - Seed §6 starter badges, first_gamification_seen_at + welcome_gamification RPC
-- - Trigger hooks: corrective_bonus, cert, redemption; tenure pg_cron
-- =============================================================================

-- -----------------------------------------------------------------------------
-- COLUMN: app_users.first_gamification_seen_at (Gate 0 resolution — First Light)
-- -----------------------------------------------------------------------------
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS first_gamification_seen_at timestamptz;

COMMENT ON COLUMN public.app_users.first_gamification_seen_at IS
  'First gamification welcome RPC call; NULL until user sees My Progress welcome.';

-- -----------------------------------------------------------------------------
-- SEED: starter badges (§6)
-- -----------------------------------------------------------------------------
INSERT INTO public.badges
  (badge_key, category, title, description, condition_spec, prestige_max, is_feed_worthy, sort_order)
VALUES
  (
    'first_light',
    'onboarding',
    'First Light',
    'Opened My Progress for the first time.',
    '{"type":"first_visit"}'::jsonb,
    1, false, 10
  ),
  (
    'on_the_board',
    'progression',
    'On the Board',
    'Reached your first major tier beyond Seedling.',
    '{"type":"tier_promotion","min_tier_order":2}'::jsonb,
    1, false, 20
  ),
  (
    'sharp_eye',
    'safety',
    'Sharp Eye',
    'Filed near-miss reports that led to verified corrective action.',
    '{"type":"near_miss_actionable","signal":"corrective_bonus"}'::jsonb,
    3, true, 30
  ),
  (
    'certified',
    'safety',
    'Certified',
    'Earned your first active certification.',
    '{"type":"cert_active","min_distinct_types":1}'::jsonb,
    1, true, 40
  ),
  (
    'stacked',
    'safety',
    'Stacked',
    'Holds multiple active certification types.',
    '{"type":"cert_active","min_distinct_types":3}'::jsonb,
    3, true, 50
  ),
  (
    'cashed_in',
    'redemption',
    'Cashed In',
    'Redeemed reward points for the first time.',
    '{"type":"redemption_created","min_count":1}'::jsonb,
    1, false, 60
  ),
  (
    'lit',
    'engagement',
    'Lit',
    'Maintained a weekly meaningful-action streak.',
    '{"type":"streak_weeks","signal":"streak_state"}'::jsonb,
    3, true, 70
  ),
  (
    'one_ring',
    'tenure',
    'One Ring',
    'One year with ATTS.',
    '{"type":"tenure_years","min_years":1}'::jsonb,
    1, true, 80
  ),
  (
    'five_rings',
    'tenure',
    'Five Rings',
    'Five years with ATTS.',
    '{"type":"tenure_years","min_years":5}'::jsonb,
    1, true, 90
  ),
  (
    'old_timber',
    'tenure',
    'Old Timber',
    'Ten years with ATTS.',
    '{"type":"tenure_years","min_years":10}'::jsonb,
    1, true, 100
  )
ON CONFLICT (badge_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- FUNCTION: award_badge (idempotent — unique on user_id, badge_key, prestige_tier)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_badge(
  p_user_id         uuid,
  p_badge_key       text,
  p_prestige_tier   int DEFAULT 1,
  p_reference_id    uuid DEFAULT NULL,
  p_reference_table text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_badge_key IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_prestige_tier IS NULL OR p_prestige_tier NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'award_badge: prestige_tier must be 1–3, got %', p_prestige_tier;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.badges b
    WHERE b.badge_key = p_badge_key
      AND b.is_active
      AND p_prestige_tier <= b.prestige_max
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_badges
    (user_id, badge_key, prestige_tier, reference_id, reference_table)
  VALUES
    (p_user_id, p_badge_key, p_prestige_tier, p_reference_id, p_reference_table)
  ON CONFLICT (user_id, badge_key, prestige_tier) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.award_badge(uuid, text, int, uuid, text) IS
  'Idempotent badge award. Returns user_badges.id or NULL if already awarded / invalid badge.';

-- -----------------------------------------------------------------------------
-- FUNCTION: evaluate_user_badges
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_badges(
  p_user_id uuid,
  p_trigger text DEFAULT 'all'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actionable_count   int;
  v_distinct_certs     int;
  v_has_redemption     boolean;
  v_streak_weeks       int;
  v_tenure_years       int;
  v_tier_order         int;
  v_sharp_thresholds   jsonb;
  v_stacked_thresholds jsonb;
  v_streak_thresholds  jsonb;
  v_threshold          int;
  v_tier               int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT value INTO v_sharp_thresholds
  FROM public.gamification_settings WHERE key = 'sharp_eye_prestige_counts';
  SELECT value INTO v_stacked_thresholds
  FROM public.gamification_settings WHERE key = 'cert_stacked_prestige_counts';
  SELECT value INTO v_streak_thresholds
  FROM public.gamification_settings WHERE key = 'streak_milestone_weeks';

  -- Sharp Eye — actionable near-misses via corrective_bonus per incident (Gate 0 resolution)
  IF p_trigger IN ('all', 'near_miss_actionable') THEN
    SELECT count(DISTINCT ca.incident_id)::int
    INTO v_actionable_count
    FROM public.point_transactions pt
    JOIN public.corrective_actions ca ON ca.id = pt.reference_id
    JOIN public.safety_incidents si ON si.id = ca.incident_id
    WHERE pt.user_id = p_user_id
      AND pt.source = 'near_miss_report'
      AND pt.category = 'corrective_bonus'
      AND pt.amount > 0
      AND si.severity = 'near_miss';

    IF v_sharp_thresholds IS NOT NULL AND jsonb_typeof(v_sharp_thresholds) = 'array' THEN
      FOR v_tier IN 1..LEAST(jsonb_array_length(v_sharp_thresholds), 3) LOOP
        v_threshold := (v_sharp_thresholds->>(v_tier - 1))::int;
        IF v_actionable_count >= v_threshold THEN
          PERFORM public.award_badge(p_user_id, 'sharp_eye', v_tier);
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Certified + Stacked — active certification types
  IF p_trigger IN ('all', 'cert_active') THEN
    SELECT count(DISTINCT cr.certification_type_id)::int
    INTO v_distinct_certs
    FROM public.certification_records cr
    WHERE cr.user_id = p_user_id
      AND cr.status = 'active';

    IF v_distinct_certs >= 1 THEN
      PERFORM public.award_badge(p_user_id, 'certified', 1);
    END IF;

    IF v_stacked_thresholds IS NOT NULL AND jsonb_typeof(v_stacked_thresholds) = 'array' THEN
      FOR v_tier IN 1..LEAST(jsonb_array_length(v_stacked_thresholds), 3) LOOP
        v_threshold := (v_stacked_thresholds->>(v_tier - 1))::int;
        IF v_distinct_certs >= v_threshold THEN
          PERFORM public.award_badge(p_user_id, 'stacked', v_tier);
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Cashed In — first redemption
  IF p_trigger IN ('all', 'redemption') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.redemptions r WHERE r.user_id = p_user_id
    ) INTO v_has_redemption;

    IF v_has_redemption THEN
      PERFORM public.award_badge(p_user_id, 'cashed_in', 1);
    END IF;
  END IF;

  -- On the Board — first major tier (tier_order >= 2)
  IF p_trigger IN ('all', 'tier_up') THEN
    SELECT gl.tier_order
    INTO v_tier_order
    FROM public.get_user_level(p_user_id) gl;

    IF COALESCE(v_tier_order, 1) >= 2 THEN
      PERFORM public.award_badge(p_user_id, 'on_the_board', 1);
    END IF;
  END IF;

  -- Lit — streak week milestones (streak engine populates streak_state in Gate 3)
  IF p_trigger IN ('all', 'streak') THEN
    SELECT ss.current_streak_weeks
    INTO v_streak_weeks
    FROM public.streak_state ss
    WHERE ss.user_id = p_user_id;

    v_streak_weeks := COALESCE(v_streak_weeks, 0);

    IF v_streak_thresholds IS NOT NULL AND jsonb_typeof(v_streak_thresholds) = 'array' THEN
      FOR v_tier IN 1..LEAST(jsonb_array_length(v_streak_thresholds), 3) LOOP
        v_threshold := (v_streak_thresholds->>(v_tier - 1))::int;
        IF v_streak_weeks >= v_threshold THEN
          PERFORM public.award_badge(p_user_id, 'lit', v_tier);
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Tenure — skip NULL hire_date gracefully
  IF p_trigger IN ('all', 'tenure') THEN
    SELECT
      EXTRACT(YEAR FROM age(current_date, au.hire_date))::int
    INTO v_tenure_years
    FROM public.app_users au
    WHERE au.user_id = p_user_id
      AND au.hire_date IS NOT NULL;

    IF v_tenure_years IS NOT NULL THEN
      IF v_tenure_years >= 1 THEN
        PERFORM public.award_badge(p_user_id, 'one_ring', 1);
      END IF;
      IF v_tenure_years >= 5 THEN
        PERFORM public.award_badge(p_user_id, 'five_rings', 1);
      END IF;
      IF v_tenure_years >= 10 THEN
        PERFORM public.award_badge(p_user_id, 'old_timber', 1);
      END IF;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.evaluate_user_badges(uuid, text) IS
  'Evaluates and idempotently awards eligible badges for a user. Trigger: all|first_visit|tier_up|near_miss_actionable|cert_active|redemption|streak|tenure.';

-- -----------------------------------------------------------------------------
-- FUNCTION: welcome_gamification — First Light + retroactive level reveal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.welcome_gamification()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_was_null   boolean;
  v_level      record;
  v_badge_rows jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users au WHERE au.user_id = v_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT (au.first_gamification_seen_at IS NULL)
  INTO v_was_null
  FROM public.app_users au
  WHERE au.user_id = v_user;

  IF v_was_null THEN
    UPDATE public.app_users
    SET first_gamification_seen_at = now()
    WHERE user_id = v_user
      AND first_gamification_seen_at IS NULL;

    PERFORM public.award_badge(v_user, 'first_light', 1);
  END IF;

  PERFORM public.evaluate_user_badges(v_user, 'all');

  SELECT * INTO v_level FROM public.get_user_level(v_user);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'badge_key', ub.badge_key,
        'prestige_tier', ub.prestige_tier,
        'awarded_at', ub.awarded_at
      )
      ORDER BY ub.awarded_at
    ),
    '[]'::jsonb
  )
  INTO v_badge_rows
  FROM public.user_badges ub
  WHERE ub.user_id = v_user;

  RETURN jsonb_build_object(
    'first_visit', v_was_null,
    'first_gamification_seen_at', (
      SELECT au.first_gamification_seen_at
      FROM public.app_users au WHERE au.user_id = v_user
    ),
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
    'badges', v_badge_rows
  );
END;
$$;

COMMENT ON FUNCTION public.welcome_gamification() IS
  'First-run welcome: stamps first_gamification_seen_at, awards First Light, evaluates badges, returns level + badges.';

-- -----------------------------------------------------------------------------
-- FUNCTION: evaluate_tenure_badges_cron — daily tenure pass + NULL hire_date stats
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_tenure_badges_cron()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_null_hire int;
  v_processed int := 0;
  r record;
BEGIN
  SELECT count(*)::int
  INTO v_null_hire
  FROM public.app_users au
  WHERE au.hire_date IS NULL;

  FOR r IN
    SELECT au.user_id
    FROM public.app_users au
    WHERE au.hire_date IS NOT NULL
  LOOP
    PERFORM public.evaluate_user_badges(r.user_id, 'tenure');
    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_with_hire_date', v_processed,
    'null_hire_date_count', v_null_hire,
    'evaluated_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.evaluate_tenure_badges_cron() IS
  'Daily tenure badge evaluation. Skips NULL hire_date; returns NULL count for admin backfill tracking.';

-- -----------------------------------------------------------------------------
-- TRIGGER: corrective_bonus point row → Sharp Eye evaluation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_evaluate_badges_on_point_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'near_miss_report' AND NEW.category = 'corrective_bonus' AND NEW.amount > 0 THEN
    BEGIN
      PERFORM public.evaluate_user_badges(NEW.user_id, 'near_miss_actionable');
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'badge eval near_miss_actionable failed for user %: %', NEW.user_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluate_badges_point_tx ON public.point_transactions;
CREATE TRIGGER trg_evaluate_badges_point_tx
  AFTER INSERT ON public.point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evaluate_badges_on_point_transaction();

-- -----------------------------------------------------------------------------
-- EXTEND: award_certification_points → cert badge evaluation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_certification_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount        integer;
  v_category      text;
  v_completing_id uuid;
  v_has_practical boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT has_practical_eval INTO v_has_practical
  FROM public.certification_types
  WHERE id = NEW.certification_type_id;

  IF COALESCE(v_has_practical, false) AND NEW.practical_evaluation_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_completing_id := COALESCE(NEW.practical_evaluation_id, NEW.written_attempt_id);
  IF v_completing_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND OLD.expires_at > now() THEN
    v_category := 'early_renewal';
    v_amount := public.get_point_rule('certification', 'early_renewal_amount');
  ELSIF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active') THEN
    v_category := 'pass';
    v_amount := public.get_point_rule('certification', 'pass_amount');
  ELSE
    RETURN NEW;
  END IF;

  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.insert_point_transaction(
    NEW.user_id,
    v_amount,
    'certification',
    v_completing_id,
    'certification_records',
    v_category,
    true
  );

  BEGIN
    PERFORM public.evaluate_user_badges(NEW.user_id, 'cert_active');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'badge eval cert_active failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- EXTEND: redeem_reward → Cashed In badge evaluation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_item_id    uuid,
  p_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user          uuid := auth.uid();
  v_existing      uuid;
  v_item          public.reward_catalog;
  v_balance       integer;
  v_redemption_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users au WHERE au.user_id = v_user) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('redeem_reward:' || v_user::text));

  SELECT r.id INTO v_existing
  FROM public.redemptions r
  WHERE r.user_id = v_user AND r.request_id = p_request_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_item
  FROM public.reward_catalog
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF NOT v_item.is_active THEN
    RAISE EXCEPTION 'Item is not available';
  END IF;

  IF v_item.stock_qty IS NOT NULL THEN
    UPDATE public.reward_catalog
    SET stock_qty = stock_qty - 1,
        updated_at = now()
    WHERE id = p_item_id
      AND stock_qty > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Out of stock';
    END IF;
  END IF;

  v_balance := public.get_user_point_balance(v_user);
  IF v_balance < v_item.point_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.redemptions
    (user_id, item_id, point_cost, status, request_id)
  VALUES
    (v_user, p_item_id, v_item.point_cost, 'pending', p_request_id)
  RETURNING id INTO v_redemption_id;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle)
  VALUES
    (v_user, -v_item.point_cost, 'redemption', v_redemption_id, 'redemptions', false);

  BEGIN
    PERFORM public._notify_redemption_pending_admins(v_redemption_id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'redemption pending admin notify failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.evaluate_user_badges(v_user, 'redemption');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'badge eval redemption failed for user %: %', v_user, SQLERRM;
  END;

  RETURN v_redemption_id;

EXCEPTION
  WHEN unique_violation THEN
    SELECT r.id INTO v_existing
    FROM public.redemptions r
    WHERE r.user_id = v_user AND r.request_id = p_request_id;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
    RAISE;
END;
$$;

-- -----------------------------------------------------------------------------
-- pg_cron: daily tenure badge evaluation (6 AM Central ≈ dual UTC slots)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-tenure-badges-utc12') THEN
      PERFORM cron.schedule(
        'gamification-tenure-badges-utc12',
        '0 12 * * *',
        $cron$SELECT public.evaluate_tenure_badges_cron();$cron$
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-tenure-badges-utc11') THEN
      PERFORM cron.schedule(
        'gamification-tenure-badges-utc11',
        '0 11 * * *',
        $cron$SELECT public.evaluate_tenure_badges_cron();$cron$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available; skipping gamification tenure badge schedule: %', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.award_badge(uuid, text, int, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_user_badges(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.welcome_gamification() TO authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_tenure_badges_cron() TO service_role;
