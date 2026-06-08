-- =============================================================================
-- Gamification Phase 1 — Gate 3: weekly streak engine (badge-only, additive)
-- - chicago_iso_week_start, RTO week cover, record/refresh streak
-- - Meaningful actions → streak_week_activity; NO streak_bonus ledger rows
-- - Existing daily briefing streak (sync_streak_bonuses_for_user) UNTOUCHED
-- - Lit badge via evaluate_user_badges('streak') after refresh
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FUNCTION: chicago_iso_week_start — Monday week boundary (America/Chicago)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chicago_iso_week_start(p_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT (date_trunc('week', (p_ts AT TIME ZONE 'America/Chicago')::timestamp))::date;
$$;

COMMENT ON FUNCTION public.chicago_iso_week_start(timestamptz) IS
  'ISO week start (Monday) for a timestamptz in America/Chicago. Gate 3 weekly streak boundary.';

-- -----------------------------------------------------------------------------
-- FUNCTION: user_has_rto_covering_week — all Mon–Fri covered by approved RTO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_rto_covering_week(
  p_user_id    uuid,
  p_week_start date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM generate_series(p_week_start, p_week_start + 4, interval '1 day') AS gs(d)
    WHERE EXTRACT(DOW FROM gs.d) BETWEEN 1 AND 5
      AND NOT EXISTS (
        SELECT 1
        FROM public.rto_requests r
        WHERE r.user_id = p_user_id
          AND r.status = 'Approved'
          AND gs.d::date BETWEEN r.start_date AND r.end_date
      )
  );
$$;

COMMENT ON FUNCTION public.user_has_rto_covering_week(uuid, date) IS
  'True when every weekday (Mon–Fri) in the Chicago ISO week is covered by an approved RTO. Auto-protects weekly streak without spending manual freeze.';

-- -----------------------------------------------------------------------------
-- FUNCTION: week_has_meaningful_streak_activity
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.week_has_meaningful_streak_activity(
  p_user_id    uuid,
  p_week_start date
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.streak_week_activity swa
    WHERE swa.user_id = p_user_id
      AND swa.week_start = p_week_start
      AND swa.activity_source NOT IN ('manual_freeze', 'rto_auto_protect')
  );
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: ensure_streak_state — lazy init with freezes from settings
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_streak_state(p_user_id uuid)
RETURNS public.streak_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   public.streak_state;
  v_freeze int;
BEGIN
  SELECT * INTO v_row FROM public.streak_state WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT COALESCE((gs.value)::int, 1)
  INTO v_freeze
  FROM public.gamification_settings gs
  WHERE gs.key = 'streak_freezes_per_user';

  INSERT INTO public.streak_state (user_id, freezes_remaining)
  VALUES (p_user_id, COALESCE(v_freeze, 1))
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- -----------------------------------------------------------------------------
-- FUNCTION: refresh_user_streak — recompute current/longest from week anchor
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_user_streak(
  p_user_id uuid,
  p_as_of   timestamptz DEFAULT now()
)
RETURNS public.streak_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state          public.streak_state;
  v_current_week   date;
  v_anchor_week    date;
  v_week           date;
  v_streak         int := 0;
  v_freezes        int;
  v_used_freeze    boolean := false;
  v_last_active    date;
  v_longest        int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_state := public.ensure_streak_state(p_user_id);
  v_freezes := v_state.freezes_remaining;
  v_current_week := public.chicago_iso_week_start(p_as_of);

  IF public.week_has_meaningful_streak_activity(p_user_id, v_current_week)
     OR public.user_has_rto_covering_week(p_user_id, v_current_week) THEN
    v_anchor_week := v_current_week;
  ELSE
    v_anchor_week := v_current_week - 7;
  END IF;

  v_week := v_anchor_week;

  WHILE v_week IS NOT NULL LOOP
    IF public.week_has_meaningful_streak_activity(p_user_id, v_week)
       OR public.user_has_rto_covering_week(p_user_id, v_week)
       OR EXISTS (
         SELECT 1 FROM public.streak_week_activity swa
         WHERE swa.user_id = p_user_id
           AND swa.week_start = v_week
           AND swa.activity_source = 'manual_freeze'
       ) THEN
      v_streak := v_streak + 1;
      v_week := v_week - 7;

    ELSIF v_freezes > 0
          AND NOT v_used_freeze
          AND v_streak > 0
          AND EXISTS (
            SELECT 1
            FROM public.streak_week_activity swa
            WHERE swa.user_id = p_user_id
              AND swa.week_start < v_week
              AND swa.activity_source NOT IN ('manual_freeze', 'rto_auto_protect')
          ) THEN
      -- Bridge exactly one gap between newer and older meaningful-active weeks
      INSERT INTO public.streak_week_activity
        (user_id, week_start, activity_source, reference_id)
      VALUES
        (p_user_id, v_week, 'manual_freeze', '00000000-0000-0000-0000-000000000000'::uuid)
      ON CONFLICT DO NOTHING;

      v_freezes := v_freezes - 1;
      v_used_freeze := true;
      v_streak := v_streak + 1;
      v_week := v_week - 7;

    ELSE
      EXIT;
    END IF;
  END LOOP;

  SELECT max(swa.week_start)
  INTO v_last_active
  FROM public.streak_week_activity swa
  WHERE swa.user_id = p_user_id
    AND swa.activity_source NOT IN ('manual_freeze', 'rto_auto_protect');

  v_longest := GREATEST(COALESCE(v_state.longest_streak, 0), v_streak);

  UPDATE public.streak_state
  SET
    current_streak_weeks = v_streak,
    longest_streak       = v_longest,
    last_active_week     = v_last_active,
    freezes_remaining    = v_freezes,
    updated_at           = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_state;

  RETURN v_state;
END;
$$;

COMMENT ON FUNCTION public.refresh_user_streak(uuid, timestamptz) IS
  'Recomputes weekly streak (Chicago ISO weeks). One manual freeze bridges a single gap week; RTO-covered weeks auto-protect without consuming freeze. Badge-only — no ledger points.';

-- -----------------------------------------------------------------------------
-- FUNCTION: record_streak_activity — idempotent week log + refresh + Lit eval
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_streak_activity(
  p_user_id         uuid,
  p_activity_source text,
  p_reference_id    uuid DEFAULT NULL,
  p_activity_at     timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week date;
BEGIN
  IF p_user_id IS NULL OR p_activity_source IS NULL OR btrim(p_activity_source) = '' THEN
    RETURN;
  END IF;

  v_week := public.chicago_iso_week_start(p_activity_at);

  INSERT INTO public.streak_week_activity
    (user_id, week_start, activity_source, reference_id, recorded_at)
  VALUES
    (p_user_id, v_week, p_activity_source, COALESCE(p_reference_id, gen_random_uuid()), p_activity_at)
  ON CONFLICT DO NOTHING;

  PERFORM public.refresh_user_streak(p_user_id, p_activity_at);

  BEGIN
    PERFORM public.evaluate_user_badges(p_user_id, 'streak');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'weekly streak badge eval failed for user %: %', p_user_id, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION public.record_streak_activity(uuid, text, uuid, timestamptz) IS
  'Records a meaningful weekly action and refreshes streak state. Does not write streak_bonus ledger rows.';

-- -----------------------------------------------------------------------------
-- TRIGGER: point_transactions earning rows → weekly streak (not streak_bonus)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_record_weekly_streak_on_point_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.source IN (
    'announcement_claim',
    'compliance_form',
    'near_miss_report',
    'certification',
    'manual_award'
  ) THEN
    BEGIN
      PERFORM public.record_streak_activity(
        NEW.user_id,
        NEW.source::text,
        NEW.id,
        NEW.created_at
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'weekly streak record failed for user % source %: %',
          NEW.user_id, NEW.source, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_streak_point_tx ON public.point_transactions;
CREATE TRIGGER trg_weekly_streak_point_tx
  AFTER INSERT ON public.point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_record_weekly_streak_on_point_tx();

-- -----------------------------------------------------------------------------
-- TRIGGER: safety briefing completion → weekly streak (briefing also pays briefing bonus)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_record_weekly_streak_on_briefing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.record_streak_activity(
      NEW.user_id,
      'briefing_completion',
      NEW.id,
      COALESCE(NEW.completed_at, now())
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'weekly streak briefing record failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_streak_briefing ON public.safety_briefing_answers;
CREATE TRIGGER trg_weekly_streak_briefing
  AFTER INSERT ON public.safety_briefing_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_record_weekly_streak_on_briefing();

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.chicago_iso_week_start(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_rto_covering_week(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.week_has_meaningful_streak_activity(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_streak(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_streak_activity(uuid, text, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_streak_state(uuid) TO service_role;
