-- =============================================================================
-- Gamification Phase 1 — Gate 6: launch readiness
-- - hire_date precondition (assert before baseline capture)
-- - capture_gamification_baseline_cohort (one-time pre-launch snapshot)
-- - is_gamification_program_admin (admin + safety_officer)
-- - Extend admin metrics + baseline cohort RLS to safety_officer
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION: is_gamification_test_account
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_gamification_test_account(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_email IS NOT NULL
    AND (
      lower(p_email) LIKE '%@atts.test'
      OR lower(p_email) LIKE '%@example.invalid'
    );
$$;

COMMENT ON FUNCTION public.is_gamification_test_account(text) IS
  'True for seeded E2E (@atts.test) and localgate (@example.invalid) accounts.';

-- -----------------------------------------------------------------------------
-- FUNCTION: is_gamification_program_admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_gamification_program_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.app_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'safety_officer'
    );
$$;

COMMENT ON FUNCTION public.is_gamification_program_admin() IS
  'Admin or safety_officer — gamification program tools and analytics.';

GRANT EXECUTE ON FUNCTION public.is_gamification_program_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: get_real_users_missing_hire_date
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_real_users_missing_hire_date()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', au.user_id,
          'full_name', au.full_name,
          'email', u.email,
          'role', au.role
        )
        ORDER BY au.full_name NULLS LAST, u.email
      )
      FROM public.app_users au
      JOIN auth.users u ON u.id = au.user_id
      WHERE au.hire_date IS NULL
        AND NOT public.is_gamification_test_account(u.email)
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.get_real_users_missing_hire_date() IS
  'Non-test app_users with NULL hire_date. Gate 6 precondition for baseline capture.';

GRANT EXECUTE ON FUNCTION public.get_real_users_missing_hire_date() TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: assert_hire_dates_for_baseline
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_hire_dates_for_baseline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing jsonb;
  v_count int;
BEGIN
  SELECT COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', au.user_id,
          'full_name', au.full_name,
          'email', u.email,
          'role', au.role
        )
        ORDER BY au.full_name NULLS LAST, u.email
      )
      FROM public.app_users au
      JOIN auth.users u ON u.id = au.user_id
      WHERE au.hire_date IS NULL
        AND NOT public.is_gamification_test_account(u.email)
    ),
    '[]'::jsonb
  )
  INTO v_missing;

  v_count := jsonb_array_length(v_missing);

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'hire_date precondition failed: % real user(s) missing hire_date: %',
      v_count,
      v_missing::text;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_hire_dates_for_baseline() IS
  'Raises when any non-test user lacks hire_date. Required before baseline capture.';

REVOKE ALL ON FUNCTION public.assert_hire_dates_for_baseline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_hire_dates_for_baseline() TO service_role;

-- -----------------------------------------------------------------------------
-- FUNCTION: capture_gamification_baseline_cohort (one-time, admin-only)
-- Cohort: competition-eligible non-test users with ≤2 qualifying active days
-- in the 90 calendar days before capture (America/Chicago).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.capture_gamification_baseline_cohort()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capture_date date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_window_start date := v_capture_date - 90;
  v_existing int;
  v_inserted int;
  v_missing jsonb;
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  SELECT count(*)::int
  INTO v_existing
  FROM public.gamification_baseline_cohort;

  IF v_existing > 0 THEN
    RAISE EXCEPTION
      'baseline cohort already captured (% user(s) on file). Re-baseline is not supported in Phase 1.',
      v_existing;
  END IF;

  PERFORM public.assert_hire_dates_for_baseline();

  WITH earn AS (
    SELECT
      pt.user_id,
      COALESCE(SUM(pt.amount), 0)::int AS prior_90d_earn
    FROM public.point_transactions pt
    WHERE pt.amount > 0
      AND pt.source IN (
        'announcement_claim', 'compliance_form', 'streak_bonus',
        'near_miss_report', 'certification', 'manual_award'
      )
      AND (pt.created_at AT TIME ZONE 'America/Chicago')::date >= v_window_start
      AND (pt.created_at AT TIME ZONE 'America/Chicago')::date < v_capture_date
    GROUP BY pt.user_id
  ),
  days AS (
    SELECT
      pt.user_id,
      count(DISTINCT (pt.created_at AT TIME ZONE 'America/Chicago')::date)::int AS prior_90d_active_days
    FROM public.point_transactions pt
    WHERE pt.amount > 0
      AND pt.source IN (
        'announcement_claim', 'compliance_form', 'streak_bonus',
        'near_miss_report', 'certification', 'manual_award'
      )
      AND (pt.created_at AT TIME ZONE 'America/Chicago')::date >= v_window_start
      AND (pt.created_at AT TIME ZONE 'America/Chicago')::date < v_capture_date
    GROUP BY pt.user_id
  ),
  cohort AS (
    SELECT
      au.user_id,
      COALESCE(earn.prior_90d_earn, 0)::int AS prior_90d_earn,
      COALESCE(days.prior_90d_active_days, 0)::int AS prior_90d_active_days
    FROM public.app_users au
    JOIN auth.users u ON u.id = au.user_id
    LEFT JOIN earn ON earn.user_id = au.user_id
    LEFT JOIN days ON days.user_id = au.user_id
    WHERE public.is_competition_eligible(au.user_id)
      AND NOT public.is_gamification_test_account(u.email)
      AND COALESCE(days.prior_90d_active_days, 0) <= 2
  ),
  ins AS (
    INSERT INTO public.gamification_baseline_cohort
      (user_id, captured_at, snapshot_reason, prior_90d_earn, prior_90d_active_days)
    SELECT
      c.user_id,
      now(),
      'pre_launch_90d_rarely_active',
      c.prior_90d_earn,
      c.prior_90d_active_days
    FROM cohort c
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;

  SELECT public.get_real_users_missing_hire_date() INTO v_missing;

  RETURN jsonb_build_object(
    'status', 'captured',
    'cohort_size', v_inserted,
    'capture_date', v_capture_date,
    'window_start', v_window_start,
    'missing_hire_dates', v_missing,
    'missing_hire_date_count', jsonb_array_length(v_missing)
  );
END;
$$;

COMMENT ON FUNCTION public.capture_gamification_baseline_cohort() IS
  'One-time pre-launch baseline snapshot. Asserts hire_date precondition; refuses if already captured.';

GRANT EXECUTE ON FUNCTION public.capture_gamification_baseline_cohort() TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: verify_gamification_workforce_levels
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_gamification_workforce_levels()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_users int := 0;
  v_errors int := 0;
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  FOR r IN SELECT au.user_id FROM public.app_users au LOOP
    v_users := v_users + 1;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.get_user_level(r.user_id) gl) THEN
        v_errors := v_errors + 1;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'user_count', v_users,
    'error_count', v_errors,
    'status', CASE WHEN v_errors = 0 THEN 'ok' ELSE 'errors' END
  );
END;
$$;

COMMENT ON FUNCTION public.verify_gamification_workforce_levels() IS
  'Retroactive level spot-check across all app_users. Gate 6 launch readiness.';

GRANT EXECUTE ON FUNCTION public.verify_gamification_workforce_levels() TO authenticated;

-- -----------------------------------------------------------------------------
-- EXTEND: get_gamification_admin_metrics — safety_officer access
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
  v_missing_hire jsonb;
  v_result jsonb;
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_start := p_start_date::timestamptz;
  v_end := (p_end_date + 1)::timestamptz;
  v_span_days := (p_end_date - p_start_date) + 1;
  v_prior_end := p_start_date - 1;
  v_prior_start := v_prior_end - (v_span_days - 1);

  SELECT public.get_real_users_missing_hire_date() INTO v_missing_hire;

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
    'hire_date_precondition', jsonb_build_object(
      'missing_count', jsonb_array_length(v_missing_hire),
      'missing_users', v_missing_hire
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

-- -----------------------------------------------------------------------------
-- RLS: baseline cohort readable by safety_officer
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins read gamification baseline cohort" ON public.gamification_baseline_cohort;
CREATE POLICY "Program admins read gamification baseline cohort"
  ON public.gamification_baseline_cohort FOR SELECT TO authenticated
  USING (public.is_gamification_program_admin());
