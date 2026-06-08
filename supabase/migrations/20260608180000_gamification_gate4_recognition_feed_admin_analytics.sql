-- =============================================================================
-- Gamification Phase 1 — Gate 4: recognition feed emitter + admin analytics
-- - emit_recognition_event (idempotent dedupe_key)
-- - Feed hooks: major tier promotions, feed-worthy badges, tenure milestones
-- - gamification_baseline_cohort (structure — snapshot in Gate 6)
-- - is_competition_eligible, get_gamification_admin_metrics
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: gamification_baseline_cohort (snapshot captured in Gate 6)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gamification_baseline_cohort (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  captured_at             timestamptz NOT NULL DEFAULT now(),
  snapshot_reason         text NOT NULL DEFAULT 'pre_launch_90d_rarely_active',
  prior_90d_earn          int NOT NULL CHECK (prior_90d_earn >= 0),
  prior_90d_active_days   int NOT NULL CHECK (prior_90d_active_days >= 0)
);

COMMENT ON TABLE public.gamification_baseline_cohort IS
  'Pre-launch long-tail baseline cohort. Populated in Gate 6; analytics degrade gracefully until then.';

ALTER TABLE public.gamification_baseline_cohort ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read gamification baseline cohort" ON public.gamification_baseline_cohort;
CREATE POLICY "Admins read gamification baseline cohort"
  ON public.gamification_baseline_cohort FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access gamification baseline cohort" ON public.gamification_baseline_cohort;
CREATE POLICY "Service role full access gamification baseline cohort"
  ON public.gamification_baseline_cohort TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- FUNCTION: is_competition_eligible (FIELD_ROLES standings filter)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_competition_eligible(
  target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_roles jsonb;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT au.role
  INTO v_role
  FROM public.app_users au
  WHERE au.user_id = target_user_id;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT gs.value
  INTO v_roles
  FROM public.gamification_settings gs
  WHERE gs.key = 'competition_eligible_roles';

  IF v_roles IS NULL OR jsonb_typeof(v_roles) <> 'array' THEN
    RETURN v_role IN ('employee', 'foreman', 'general_foreman', 'mechanic');
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(v_roles) AS r(role)
    WHERE r.role = v_role
  );
END;
$$;

COMMENT ON FUNCTION public.is_competition_eligible(uuid) IS
  'True when user role is in gamification_settings.competition_eligible_roles (FIELD_ROLES).';

-- -----------------------------------------------------------------------------
-- FUNCTION: emit_recognition_event (idempotent via dedupe_key)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_recognition_event(
  p_event_type      public.recognition_event_type,
  p_subject_user_id uuid,
  p_payload         jsonb,
  p_dedupe_key      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_subject_user_id IS NULL OR p_dedupe_key IS NULL OR btrim(p_dedupe_key) = '' THEN
    RETURN NULL;
  END IF;

  IF p_payload IS NULL OR p_payload = 'null'::jsonb THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.recognition_feed
    (event_type, subject_user_id, payload, dedupe_key)
  VALUES
    (p_event_type, p_subject_user_id, p_payload, p_dedupe_key)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.emit_recognition_event(public.recognition_event_type, uuid, jsonb, text) IS
  'Idempotent recognition feed insert. Positive-only curated events; dedupe_key prevents re-evaluation duplicates.';

REVOKE ALL ON FUNCTION public.emit_recognition_event(public.recognition_event_type, uuid, jsonb, text) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- FUNCTION: maybe_emit_badge_recognition
-- Feed-worthy: tenure milestones, Certified, prestige-max Sharp Eye/Lit/Stacked only.
-- Never: First Light, Cashed In, On the Board (tier_promotion covers major tiers).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maybe_emit_badge_recognition(
  p_user_id       uuid,
  p_badge_key     text,
  p_prestige_tier int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge record;
  v_event_type public.recognition_event_type;
  v_dedupe_key text;
  v_payload jsonb;
BEGIN
  IF p_user_id IS NULL OR p_badge_key IS NULL THEN
    RETURN;
  END IF;

  IF p_badge_key IN ('first_light', 'cashed_in', 'on_the_board') THEN
    RETURN;
  END IF;

  SELECT b.badge_key, b.title, b.category, b.prestige_max, b.is_feed_worthy
  INTO v_badge
  FROM public.badges b
  WHERE b.badge_key = p_badge_key
    AND b.is_active;

  IF NOT FOUND OR NOT v_badge.is_feed_worthy THEN
    RETURN;
  END IF;

  IF p_badge_key IN ('sharp_eye', 'stacked', 'lit') THEN
    IF p_prestige_tier IS DISTINCT FROM v_badge.prestige_max THEN
      RETURN;
    END IF;
  END IF;

  IF p_badge_key IN ('one_ring', 'five_rings', 'old_timber') THEN
    v_event_type := 'tenure_milestone';
    v_dedupe_key := 'tenure_milestone:' || p_user_id::text || ':' || p_badge_key;
  ELSE
    v_event_type := 'badge_awarded';
    v_dedupe_key := 'badge_awarded:' || p_user_id::text || ':' || p_badge_key || ':' || p_prestige_tier::text;
  END IF;

  v_payload := jsonb_build_object(
    'badge_key', v_badge.badge_key,
    'title', v_badge.title,
    'category', v_badge.category,
    'prestige_tier', p_prestige_tier
  );

  PERFORM public.emit_recognition_event(
    v_event_type,
    p_user_id,
    v_payload,
    v_dedupe_key
  );
END;
$$;

COMMENT ON FUNCTION public.maybe_emit_badge_recognition(uuid, text, int) IS
  'Emits curated badge/tenure recognition feed rows when a new badge award qualifies.';

REVOKE ALL ON FUNCTION public.maybe_emit_badge_recognition(uuid, text, int) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- FUNCTION: maybe_emit_tier_promotion_feed (major tiers only, sub_level I)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maybe_emit_tier_promotion_feed(
  p_user_id            uuid,
  p_prior_lifetime     int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifetime int;
  v_prior    int;
  r          record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  v_lifetime := public.get_user_lifetime_earned(p_user_id);
  v_prior := COALESCE(p_prior_lifetime, v_lifetime);

  FOR r IN
    SELECT
      lt.tier_key,
      lt.tier_name,
      lt.tier_order,
      lt.sub_level,
      lt.sub_level_label,
      lt.entry_threshold
    FROM public.level_tiers lt
    WHERE lt.is_active
      AND lt.sub_level = 1
      AND lt.tier_order >= 2
      AND lt.entry_threshold <= v_lifetime
      AND lt.entry_threshold > v_prior
    ORDER BY lt.entry_threshold ASC
  LOOP
    PERFORM public.emit_recognition_event(
      'tier_promotion',
      p_user_id,
      jsonb_build_object(
        'tier_key', r.tier_key,
        'tier_name', r.tier_name,
        'tier_order', r.tier_order,
        'sub_level', r.sub_level,
        'sub_level_label', r.sub_level_label,
        'lifetime_earned', v_lifetime,
        'entry_threshold', r.entry_threshold
      ),
      'tier_promotion:' || p_user_id::text || ':' || r.tier_key
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.maybe_emit_tier_promotion_feed(uuid, int) IS
  'Emits tier_promotion feed rows for newly crossed major tiers (sub_level I only). Idempotent per tier_key.';

REVOKE ALL ON FUNCTION public.maybe_emit_tier_promotion_feed(uuid, int) FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- EXTEND: award_badge — feed emission on first award
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

  IF v_id IS NOT NULL THEN
    PERFORM public.maybe_emit_badge_recognition(p_user_id, p_badge_key, p_prestige_tier);
  END IF;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- TRIGGER: earning point rows → major tier promotion feed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_emit_tier_promotion_feed_on_earn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior int;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.source NOT IN (
    'announcement_claim',
    'compliance_form',
    'streak_bonus',
    'near_miss_report',
    'certification',
    'manual_award'
  ) THEN
    RETURN NEW;
  END IF;

  v_prior := public.get_user_lifetime_earned(NEW.user_id) - NEW.amount;

  BEGIN
    PERFORM public.maybe_emit_tier_promotion_feed(NEW.user_id, v_prior);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'tier promotion feed failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recognition_feed_tier_promotion ON public.point_transactions;
CREATE TRIGGER trg_recognition_feed_tier_promotion
  AFTER INSERT ON public.point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_emit_tier_promotion_feed_on_earn();

-- -----------------------------------------------------------------------------
-- FUNCTION: get_gamification_admin_metrics
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gamification_admin_metrics(
  p_start_date date DEFAULT (current_date - 30),
  p_end_date   date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_prior_start date;
  v_prior_end   date;
  v_span_days   int;
  v_long_tail   jsonb;
  v_cohort_size int;
  v_activated   int;
  v_ledger_lifetime int;
  v_ledger_period int;
  v_metrics_period int;
  v_anomaly_count int;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_start := p_start_date::timestamptz;
  v_end := (p_end_date + 1)::timestamptz;
  v_span_days := (p_end_date - p_start_date) + 1;
  v_prior_end := p_start_date - 1;
  v_prior_start := v_prior_end - (v_span_days - 1);

  SELECT count(*)::int
  INTO v_cohort_size
  FROM public.gamification_baseline_cohort;

  IF v_cohort_size = 0 THEN
    v_long_tail := jsonb_build_object(
      'status', 'baseline_not_captured',
      'message', 'baseline not yet captured',
      'cohort_size', 0,
      'activated_count', null,
      'activation_rate_pct', null
    );
  ELSE
    SELECT count(*)::int
    INTO v_activated
    FROM public.gamification_baseline_cohort gbc
    WHERE public.get_user_lifetime_earned(gbc.user_id) > gbc.prior_90d_earn
       OR EXISTS (
         SELECT 1
         FROM public.point_transactions pt
         WHERE pt.user_id = gbc.user_id
           AND pt.amount > 0
           AND pt.created_at >= gbc.captured_at
           AND pt.source IN (
             'announcement_claim', 'compliance_form', 'streak_bonus',
             'near_miss_report', 'certification', 'manual_award'
           )
       );

    v_long_tail := jsonb_build_object(
      'status', 'ready',
      'message', null,
      'cohort_size', v_cohort_size,
      'activated_count', v_activated,
      'activation_rate_pct', round((v_activated::numeric / v_cohort_size::numeric) * 100, 2)
    );
  END IF;

  SELECT COALESCE(SUM(public.get_user_lifetime_earned(au.user_id)), 0)::int
  INTO v_ledger_lifetime
  FROM public.app_users au;

  SELECT COALESCE(SUM(pt.amount), 0)::int
  INTO v_ledger_period
  FROM public.point_transactions pt
  WHERE pt.amount > 0
    AND pt.created_at >= v_start
    AND pt.created_at < v_end
    AND pt.source IN (
      'announcement_claim', 'compliance_form', 'streak_bonus',
      'near_miss_report', 'certification', 'manual_award'
    );

  SELECT COALESCE(SUM(pt.amount), 0)::int
  INTO v_metrics_period
  FROM public.point_transactions pt
  WHERE pt.amount > 0
    AND pt.created_at >= v_start
    AND pt.created_at < v_end
    AND pt.source IN (
      'announcement_claim', 'compliance_form', 'streak_bonus',
      'near_miss_report', 'certification', 'manual_award'
    );

  SELECT count(*)::int
  INTO v_anomaly_count
  FROM (
    SELECT pt.user_id
    FROM public.point_transactions pt
    WHERE pt.amount > 0
      AND pt.created_at >= v_start
      AND pt.created_at < v_end
      AND pt.source IN (
        'announcement_claim', 'compliance_form', 'streak_bonus',
        'near_miss_report', 'certification', 'manual_award'
      )
    GROUP BY pt.user_id
    HAVING SUM(pt.amount) > (
      SELECT COALESCE(avg(sub.total) + 3 * stddev_pop(sub.total), 0)
      FROM (
        SELECT pt2.user_id, SUM(pt2.amount)::numeric AS total
        FROM public.point_transactions pt2
        WHERE pt2.amount > 0
          AND pt2.created_at >= v_start
          AND pt2.created_at < v_end
          AND pt2.source IN (
            'announcement_claim', 'compliance_form', 'streak_bonus',
            'near_miss_report', 'certification', 'manual_award'
          )
        GROUP BY pt2.user_id
      ) sub
    )
  ) flagged;

  v_result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', v_span_days
    ),
    'long_tail_activation', v_long_tail,
    'engagement', jsonb_build_object(
      'unique_session_users', (
        SELECT count(DISTINCT uas.user_id)::int
        FROM public.user_activity_sessions uas
        WHERE uas.started_at >= v_start
          AND uas.started_at < v_end
      ),
      'active_user_days', (
        SELECT count(*)::int
        FROM (
          SELECT DISTINCT pt.user_id, (pt.created_at AT TIME ZONE 'America/Chicago')::date AS d
          FROM public.point_transactions pt
          WHERE pt.amount > 0
            AND pt.created_at >= v_start
            AND pt.created_at < v_end
            AND pt.source IN (
              'announcement_claim', 'compliance_form', 'streak_bonus',
              'near_miss_report', 'certification', 'manual_award'
            )
        ) days
      ),
      'active_user_weeks', (
        SELECT count(*)::int
        FROM (
          SELECT DISTINCT swa.user_id, swa.week_start
          FROM public.streak_week_activity swa
          WHERE swa.week_start >= p_start_date
            AND swa.week_start <= p_end_date
            AND swa.activity_source NOT IN ('manual_freeze', 'rto_auto_protect')
        ) weeks
      )
    ),
    'target_behaviors', jsonb_build_object(
      'compliance_forms', jsonb_build_object(
        'count', (
          SELECT count(*)::int FROM public.point_transactions pt
          WHERE pt.source = 'compliance_form' AND pt.amount > 0
            AND pt.created_at >= v_start AND pt.created_at < v_end
        ),
        'prior_period_count', (
          SELECT count(*)::int FROM public.point_transactions pt
          WHERE pt.source = 'compliance_form' AND pt.amount > 0
            AND pt.created_at >= v_prior_start::timestamptz
            AND pt.created_at < (v_prior_end + 1)::timestamptz
        )
      ),
      'near_miss_reports', jsonb_build_object(
        'count', (
          SELECT count(*)::int FROM public.point_transactions pt
          WHERE pt.source = 'near_miss_report' AND pt.amount > 0
            AND pt.created_at >= v_start AND pt.created_at < v_end
        ),
        'prior_period_count', (
          SELECT count(*)::int FROM public.point_transactions pt
          WHERE pt.source = 'near_miss_report' AND pt.amount > 0
            AND pt.created_at >= v_prior_start::timestamptz
            AND pt.created_at < (v_prior_end + 1)::timestamptz
        )
      ),
      'certifications', jsonb_build_object(
        'count', (
          SELECT count(*)::int FROM public.point_transactions pt
          WHERE pt.source = 'certification' AND pt.amount > 0
            AND pt.created_at >= v_start AND pt.created_at < v_end
        ),
        'prior_period_count', (
          SELECT count(*)::int FROM public.point_transactions pt
          WHERE pt.source = 'certification' AND pt.amount > 0
            AND pt.created_at >= v_prior_start::timestamptz
            AND pt.created_at < (v_prior_end + 1)::timestamptz
        )
      )
    ),
    'redemption_cost', jsonb_build_object(
      'total_points_redeemed', (
        SELECT COALESCE(SUM(-pt.amount), 0)::int
        FROM public.point_transactions pt
        WHERE pt.source = 'redemption'
          AND pt.amount < 0
          AND pt.created_at >= v_start
          AND pt.created_at < v_end
      ),
      'redemption_count', (
        SELECT count(*)::int
        FROM public.redemptions r
        WHERE r.requested_at >= v_start AND r.requested_at < v_end
      ),
      'prior_period_points_redeemed', (
        SELECT COALESCE(SUM(-pt.amount), 0)::int
        FROM public.point_transactions pt
        WHERE pt.source = 'redemption'
          AND pt.amount < 0
          AND pt.created_at >= v_prior_start::timestamptz
          AND pt.created_at < (v_prior_end + 1)::timestamptz
      )
    ),
    'anomaly_flag', jsonb_build_object(
      'flagged_user_count', v_anomaly_count,
      'method', 'period_earnings_above_mean_plus_3_stddev'
    ),
    'standings', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'user_id', s.user_id,
            'lifetime_earned', s.lifetime_earned,
            'tier_name', s.tier_name,
            'sub_level_label', s.sub_level_label
          )
          ORDER BY s.lifetime_earned DESC, s.user_id
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT
          au.user_id,
          gl.lifetime_earned,
          gl.tier_name,
          gl.sub_level_label
        FROM public.app_users au
        JOIN LATERAL public.get_user_level(au.user_id) gl ON true
        WHERE public.is_competition_eligible(au.user_id)
        ORDER BY gl.lifetime_earned DESC, au.user_id
        LIMIT 25
      ) s
    ),
    'ledger_reconciliation', jsonb_build_object(
      'sum_lifetime_earned_all_users', v_ledger_lifetime,
      'sum_ledger_positive_earnings_in_period', v_ledger_period,
      'metrics_period_earnings', v_metrics_period,
      'period_totals_match', (v_ledger_period = v_metrics_period)
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_gamification_admin_metrics(date, date) IS
  'Admin gamification dashboard metrics. Long-tail activation degrades when baseline cohort is empty. Standings use is_competition_eligible.';

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.is_competition_eligible(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gamification_admin_metrics(date, date) TO authenticated;
