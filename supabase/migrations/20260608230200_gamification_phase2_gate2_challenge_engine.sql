-- =============================================================================
-- Gamification Phase 2 — Gate 2: challenge engine backend (dark / inert)
-- - challenges, campaigns (FK → challenges), challenge_completions
-- - Auto-rotating weekly pool + rotate_weekly_auto_challenge cron
-- - Flag-gated eval triggers on point_transactions + safety_briefing_answers
-- - award_challenge_completion dedicated writer (D5 — NOT insert_point_transaction)
-- Depends on: 20260608230100_gamification_phase2_gate1_season_framework.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.challenge_type AS ENUM ('auto', 'campaign');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.challenge_cadence AS ENUM ('weekly', 'season', 'custom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- TABLE: challenges
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges (
  challenge_key   text PRIMARY KEY,
  title           text NOT NULL,
  description     text,
  condition_spec  jsonb NOT NULL DEFAULT '{}'::jsonb,
  cadence         public.challenge_cadence NOT NULL DEFAULT 'weekly',
  challenge_type  public.challenge_type NOT NULL DEFAULT 'auto',
  reward_spec     jsonb NOT NULL DEFAULT '{"points":25,"counts_toward_raffle":true}'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.challenges IS
  'Challenge definitions. Phase 2 — inert until gamification_settings.challenges_enabled is true.';

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read challenges" ON public.challenges;
CREATE POLICY "Authenticated read challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage challenges" ON public.challenges;
CREATE POLICY "Admins manage challenges"
  ON public.challenges TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access challenges" ON public.challenges;
CREATE POLICY "Service role full access challenges"
  ON public.challenges TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TABLE: campaigns (FK → challenges, D10)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  campaign_key    text PRIMARY KEY,
  challenge_key   text NOT NULL REFERENCES public.challenges(challenge_key),
  title           text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  multiplier      numeric(4,2) NOT NULL DEFAULT 1.00
                    CHECK (multiplier >= 1.00),
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_window_valid CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active_window
  ON public.campaigns (is_active, starts_at, ends_at);

COMMENT ON TABLE public.campaigns IS
  'Scheduled challenge instances with optional multiplier. Overrides auto-pool when overlapping (D10).';

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read campaigns" ON public.campaigns;
CREATE POLICY "Authenticated read campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage campaigns" ON public.campaigns;
CREATE POLICY "Admins manage campaigns"
  ON public.campaigns TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access campaigns" ON public.campaigns;
CREATE POLICY "Service role full access campaigns"
  ON public.campaigns TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TABLE: challenge_completions (idempotency guard: user + challenge + window)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenge_completions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_key    text NOT NULL REFERENCES public.challenges(challenge_key),
  window_key       text NOT NULL,
  campaign_key     text REFERENCES public.campaigns(campaign_key),
  completed_at     timestamptz NOT NULL DEFAULT now(),
  base_tx_id       uuid REFERENCES public.point_transactions(id),
  multiplier_tx_id uuid REFERENCES public.point_transactions(id),
  CONSTRAINT challenge_completions_unique
    UNIQUE (user_id, challenge_key, window_key)
);

CREATE INDEX IF NOT EXISTS idx_challenge_completions_user
  ON public.challenge_completions (user_id, completed_at DESC);

COMMENT ON TABLE public.challenge_completions IS
  'One completion per user/challenge/window. base_tx_id + multiplier_tx_id store payout ledger rows.';

ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own challenge completions" ON public.challenge_completions;
CREATE POLICY "Users read own challenge completions"
  ON public.challenge_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all challenge completions" ON public.challenge_completions;
CREATE POLICY "Admins read all challenge completions"
  ON public.challenge_completions FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access challenge completions" ON public.challenge_completions;
CREATE POLICY "Service role full access challenge completions"
  ON public.challenge_completions TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Challenge ledger idempotency (outside insert_point_transaction scope — D5)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_challenge_refs
  ON public.point_transactions (source, reference_id, category)
  NULLS NOT DISTINCT
  WHERE reference_id IS NOT NULL
    AND source IN ('challenge_reward', 'campaign_multiplier_bonus');

-- -----------------------------------------------------------------------------
-- SEED: auto-rotating weekly pool challenges + settings
-- -----------------------------------------------------------------------------
INSERT INTO public.challenges (
  challenge_key, title, description, condition_spec,
  cadence, challenge_type, reward_spec, sort_order
) VALUES
  (
    'compliance_sprint',
    'Compliance Sprint',
    'All your safety forms in on time this week',
    '{"type":"compliance_full_day_in_week"}'::jsonb,
    'weekly', 'auto', '{"points":30,"counts_toward_raffle":true}'::jsonb, 10
  ),
  (
    'near_miss_week',
    'Near-Miss Week',
    'Report a near-miss that gets marked actionable',
    '{"type":"near_miss_actionable","signal":"corrective_bonus"}'::jsonb,
    'weekly', 'auto', '{"points":30,"counts_toward_raffle":true}'::jsonb, 20
  ),
  (
    'cert_or_training',
    'Cert or Training',
    'Knock out a training/cert step this week',
    '{"type":"earn_source","source":"certification"}'::jsonb,
    'weekly', 'auto', '{"points":30,"counts_toward_raffle":true}'::jsonb, 30
  )
ON CONFLICT (challenge_key) DO NOTHING;

INSERT INTO public.gamification_settings (key, value, description) VALUES
  (
    'weekly_auto_challenge_pool',
    '["compliance_sprint","near_miss_week","cert_or_training"]'::jsonb,
    'Ordered auto-rotating weekly challenge pool (Chicago ISO weeks)'
  ),
  (
    'weekly_auto_challenge_active',
    'null'::jsonb,
    'Current auto-pool selection {week_start, challenge_key} — set by rotate_weekly_auto_challenge'
  )
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Helpers: window keys + pool rotation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.weekly_challenge_window_key(p_week_start date)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT 'W:' || p_week_start::text;
$$;

COMMENT ON FUNCTION public.weekly_challenge_window_key(date) IS
  'Canonical weekly challenge window key anchored to chicago_iso_week_start Monday.';

CREATE OR REPLACE FUNCTION public.gamification_setting_text_array(p_key text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value jsonb;
  v_result text[] := ARRAY[]::text[];
  v_elem jsonb;
BEGIN
  SELECT gs.value INTO v_value
  FROM public.gamification_settings gs
  WHERE gs.key = p_key;

  IF v_value IS NULL OR jsonb_typeof(v_value) <> 'array' THEN
    RETURN v_result;
  END IF;

  FOR v_elem IN SELECT jsonb_array_elements(v_value)
  LOOP
    IF jsonb_typeof(v_elem) = 'string' THEN
      v_result := array_append(v_result, trim(both '"' from v_elem::text));
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_auto_weekly_challenge(p_week_start date)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active   jsonb;
  v_pool     text[];
  v_idx      int;
  v_len      int;
BEGIN
  SELECT gs.value
  INTO v_active
  FROM public.gamification_settings gs
  WHERE gs.key = 'weekly_auto_challenge_active';

  IF v_active IS NOT NULL
     AND jsonb_typeof(v_active) = 'object'
     AND (v_active->>'week_start')::date = p_week_start
     AND NULLIF(v_active->>'challenge_key', '') IS NOT NULL THEN
    RETURN v_active->>'challenge_key';
  END IF;

  v_pool := public.gamification_setting_text_array('weekly_auto_challenge_pool');
  v_len := COALESCE(array_length(v_pool, 1), 0);
  IF v_len = 0 THEN
    RETURN NULL;
  END IF;

  v_idx := (
    (extract(epoch FROM (p_week_start::timestamp AT TIME ZONE 'UTC'))::bigint / 604800)
  )::int % v_len;

  IF v_idx < 0 THEN
    v_idx := v_idx + v_len;
  END IF;

  RETURN v_pool[v_idx + 1];
END;
$$;

COMMENT ON FUNCTION public.resolve_auto_weekly_challenge(date) IS
  'Picks auto-pool challenge for a Chicago week (persisted active row or deterministic rotation).';

CREATE OR REPLACE FUNCTION public.get_active_challenge_for_activity(
  p_activity_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  challenge_key text,
  window_key    text,
  campaign_key  text,
  multiplier    numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start   date;
  v_week_end     timestamptz;
  v_auto         text;
  v_campaign_key text;
  v_c_challenge  text;
  v_multiplier   numeric;
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN;
  END IF;

  v_week_start := public.chicago_iso_week_start(p_activity_at);
  v_week_end := (v_week_start + 7)::timestamptz;

  SELECT c.campaign_key, c.challenge_key, c.multiplier
  INTO v_campaign_key, v_c_challenge, v_multiplier
  FROM public.campaigns c
  WHERE c.is_active
    AND p_activity_at >= c.starts_at
    AND p_activity_at < c.ends_at
    AND c.starts_at < v_week_end
    AND c.ends_at > v_week_start::timestamptz
  ORDER BY c.starts_at ASC, c.campaign_key ASC
  LIMIT 1;

  IF v_campaign_key IS NOT NULL THEN
    challenge_key := v_c_challenge;
    window_key := 'C:' || v_campaign_key;
    campaign_key := v_campaign_key;
    multiplier := v_multiplier;
    RETURN NEXT;
    RETURN;
  END IF;

  v_auto := public.resolve_auto_weekly_challenge(v_week_start);
  IF v_auto IS NULL THEN
    RETURN;
  END IF;

  challenge_key := v_auto;
  window_key := public.weekly_challenge_window_key(v_week_start);
  campaign_key := NULL;
  multiplier := 1.00;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_active_challenge_for_activity(timestamptz) IS
  'Active challenge for an activity instant. Campaign overlapping Chicago week wins over auto-pool (D10).';

-- -----------------------------------------------------------------------------
-- Condition evaluation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_condition_met(
  p_user_id         uuid,
  p_challenge_key   text,
  p_condition_spec  jsonb,
  p_trigger         text,
  p_activity_at     timestamptz,
  p_source          public.point_source DEFAULT NULL,
  p_category        text DEFAULT NULL,
  p_reference_id    uuid DEFAULT NULL,
  p_reference_table text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type       text;
  v_week_start date;
BEGIN
  v_type := p_condition_spec->>'type';
  v_week_start := public.chicago_iso_week_start(p_activity_at);

  CASE v_type
    WHEN 'compliance_full_day_in_week' THEN
      IF p_trigger <> 'ledger'
         OR p_source IS DISTINCT FROM 'compliance_form'::public.point_source THEN
        RETURN false;
      END IF;

      IF p_reference_table = 'compliance_rewards' AND p_reference_id IS NOT NULL THEN
        RETURN EXISTS (
          SELECT 1
          FROM public.compliance_rewards cr
          WHERE cr.id = p_reference_id
            AND cr.user_id = p_user_id
            AND COALESCE(array_length(cr.forms_completed, 1), 0) >= 3
            AND public.chicago_iso_week_start(cr.awarded_at) = v_week_start
        );
      END IF;

      RETURN EXISTS (
        SELECT 1
        FROM public.compliance_rewards cr
        WHERE cr.user_id = p_user_id
          AND COALESCE(array_length(cr.forms_completed, 1), 0) >= 3
          AND public.chicago_iso_week_start(cr.awarded_at) = v_week_start
          AND cr.awarded_at <= p_activity_at + interval '1 second'
      );

    WHEN 'near_miss_actionable' THEN
      RETURN p_trigger = 'ledger'
         AND p_source = 'near_miss_report'::public.point_source
         AND p_category = 'corrective_bonus';

    WHEN 'earn_source' THEN
      RETURN p_trigger = 'ledger'
         AND p_source::text = COALESCE(p_condition_spec->>'source', '');

    WHEN 'briefing_completion' THEN
      RETURN p_trigger = 'briefing';

    ELSE
      RETURN false;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.challenge_condition_met(uuid, text, jsonb, text, timestamptz, public.point_source, text, uuid, text) IS
  'Evaluates a challenge condition_spec against a qualifying activity event.';

-- -----------------------------------------------------------------------------
-- D5: Dedicated challenge payout writer — NOT insert_point_transaction().
-- insert_point_transaction ON CONFLICT only covers automatic earning sources;
-- challenge_reward + campaign_multiplier_bonus need two rows per completion
-- (base + optional multiplier bonus) keyed by completion.id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_challenge_completion(
  p_user_id       uuid,
  p_completion_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row          public.challenge_completions;
  v_challenge    public.challenges;
  v_campaign     public.campaigns;
  v_base_points  int;
  v_bonus_points int;
  v_counts       boolean;
  v_base_cat     text;
  v_base_tx      uuid;
  v_bonus_tx     uuid;
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_row
  FROM public.challenge_completions cc
  WHERE cc.id = p_completion_id
    AND cc.user_id = p_user_id
  FOR UPDATE;

  IF v_row IS NULL OR v_row.base_tx_id IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.challenges c
  WHERE c.challenge_key = v_row.challenge_key
    AND c.is_active;

  IF v_challenge IS NULL THEN
    RETURN;
  END IF;

  v_base_points := GREATEST(COALESCE((v_challenge.reward_spec->>'points')::int, 0), 0);
  v_counts := COALESCE((v_challenge.reward_spec->>'counts_toward_raffle')::boolean, true);
  v_base_cat := v_row.challenge_key || ':' || v_row.window_key;

  IF v_base_points > 0 THEN
    INSERT INTO public.point_transactions (
      user_id, amount, source, reference_id, reference_table,
      category, counts_toward_raffle
    ) VALUES (
      p_user_id,
      v_base_points,
      'challenge_reward',
      p_completion_id,
      'challenge_completions',
      v_base_cat,
      v_counts
    )
    ON CONFLICT (source, reference_id, category)
      WHERE reference_id IS NOT NULL
        AND source IN ('challenge_reward', 'campaign_multiplier_bonus')
    DO NOTHING
    RETURNING id INTO v_base_tx;

    IF v_base_tx IS NULL THEN
      SELECT pt.id
      INTO v_base_tx
      FROM public.point_transactions pt
      WHERE pt.source = 'challenge_reward'
        AND pt.reference_id = p_completion_id
        AND pt.category = v_base_cat;
    END IF;
  END IF;

  IF v_row.campaign_key IS NOT NULL THEN
    SELECT *
    INTO v_campaign
    FROM public.campaigns cam
    WHERE cam.campaign_key = v_row.campaign_key
      AND cam.is_active;

    IF v_campaign IS NOT NULL AND v_campaign.multiplier > 1.00 AND v_base_points > 0 THEN
      v_bonus_points := floor(v_base_points * (v_campaign.multiplier - 1.00))::int;

      IF v_bonus_points > 0 THEN
        INSERT INTO public.point_transactions (
          user_id, amount, source, reference_id, reference_table,
          category, counts_toward_raffle
        ) VALUES (
          p_user_id,
          v_bonus_points,
          'campaign_multiplier_bonus',
          p_completion_id,
          'challenge_completions',
          'multiplier:' || v_row.campaign_key,
          v_counts
        )
        ON CONFLICT (source, reference_id, category)
          WHERE reference_id IS NOT NULL
            AND source IN ('challenge_reward', 'campaign_multiplier_bonus')
        DO NOTHING
        RETURNING id INTO v_bonus_tx;

        IF v_bonus_tx IS NULL THEN
          SELECT pt.id
          INTO v_bonus_tx
          FROM public.point_transactions pt
          WHERE pt.source = 'campaign_multiplier_bonus'
            AND pt.reference_id = p_completion_id
            AND pt.category = 'multiplier:' || v_row.campaign_key;
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE public.challenge_completions cc
  SET
    base_tx_id = v_base_tx,
    multiplier_tx_id = v_bonus_tx
  WHERE cc.id = p_completion_id;
END;
$$;

COMMENT ON FUNCTION public.award_challenge_completion(uuid, uuid) IS
  'Writes challenge_reward base row + optional campaign_multiplier_bonus row. D5 dedicated writer.';

REVOKE ALL ON FUNCTION public.award_challenge_completion(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_challenge_completion(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.try_record_challenge_completion(
  p_user_id       uuid,
  p_challenge_key text,
  p_window_key    text,
  p_campaign_key  text DEFAULT NULL,
  p_completed_at  timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.challenge_completions (
    user_id, challenge_key, window_key, campaign_key, completed_at
  ) VALUES (
    p_user_id, p_challenge_key, p_window_key, p_campaign_key, p_completed_at
  )
  ON CONFLICT (user_id, challenge_key, window_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    PERFORM public.award_challenge_completion(p_user_id, v_id);
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.try_record_challenge_completion(uuid, text, text, text, timestamptz) IS
  'Idempotent completion insert + payout. UNIQUE (user_id, challenge_key, window_key) prevents double-pay.';

REVOKE ALL ON FUNCTION public.try_record_challenge_completion(uuid, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_record_challenge_completion(uuid, text, text, text, timestamptz) TO service_role;

-- -----------------------------------------------------------------------------
-- evaluate_user_challenges — flag-gated completion detection
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_challenges_from_ledger(
  p_user_id         uuid,
  p_source          public.point_source,
  p_category        text,
  p_reference_id    uuid,
  p_reference_table text,
  p_activity_at     timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active record;
  v_challenge public.challenges;
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_source IN (
    'streak_bonus', 'redemption', 'adjustment',
    'challenge_reward', 'campaign_multiplier_bonus'
  ) THEN
    RETURN;
  END IF;

  IF p_source NOT IN (
    'announcement_claim', 'compliance_form', 'near_miss_report',
    'certification', 'manual_award'
  ) THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_active
  FROM public.get_active_challenge_for_activity(p_activity_at)
  LIMIT 1;

  IF v_active.challenge_key IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.challenges c
  WHERE c.challenge_key = v_active.challenge_key
    AND c.is_active;

  IF v_challenge IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.challenge_condition_met(
    p_user_id,
    v_challenge.challenge_key,
    v_challenge.condition_spec,
    'ledger',
    p_activity_at,
    p_source,
    p_category,
    p_reference_id,
    p_reference_table
  ) THEN
    RETURN;
  END IF;

  PERFORM public.try_record_challenge_completion(
    p_user_id,
    v_active.challenge_key,
    v_active.window_key,
    v_active.campaign_key,
    p_activity_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_user_challenges_from_briefing(
  p_user_id     uuid,
  p_briefing_id uuid,
  p_activity_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active record;
  v_challenge public.challenges;
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_active
  FROM public.get_active_challenge_for_activity(p_activity_at)
  LIMIT 1;

  IF v_active.challenge_key IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_challenge
  FROM public.challenges c
  WHERE c.challenge_key = v_active.challenge_key
    AND c.is_active;

  IF v_challenge IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.challenge_condition_met(
    p_user_id,
    v_challenge.challenge_key,
    v_challenge.condition_spec,
    'briefing',
    p_activity_at,
    NULL, NULL, p_briefing_id, 'safety_briefing_answers'
  ) THEN
    RETURN;
  END IF;

  PERFORM public.try_record_challenge_completion(
    p_user_id,
    v_active.challenge_key,
    v_active.window_key,
    v_active.campaign_key,
    p_activity_at
  );
END;
$$;

COMMENT ON FUNCTION public.evaluate_user_challenges_from_ledger(uuid, public.point_source, text, uuid, text, timestamptz) IS
  'Flag-gated challenge eval on meaningful ledger earns (excludes streak_bonus/redemption/adjustment).';

COMMENT ON FUNCTION public.evaluate_user_challenges_from_briefing(uuid, uuid, timestamptz) IS
  'Flag-gated challenge eval on safety briefing completion.';

-- -----------------------------------------------------------------------------
-- TRIGGERS (Phase 2 only — Phase 1 streak triggers untouched)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_evaluate_challenges_on_point_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN NEW;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.evaluate_user_challenges_from_ledger(
      NEW.user_id,
      NEW.source,
      NEW.category,
      NEW.reference_id,
      NEW.reference_table,
      NEW.created_at
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'challenge eval ledger failed for user % source %: %',
        NEW.user_id, NEW.source, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluate_challenges_point_tx ON public.point_transactions;
CREATE TRIGGER trg_evaluate_challenges_point_tx
  AFTER INSERT ON public.point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evaluate_challenges_on_point_tx();

CREATE OR REPLACE FUNCTION public.trg_evaluate_challenges_on_briefing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.evaluate_user_challenges_from_briefing(
      NEW.user_id,
      NEW.id,
      COALESCE(NEW.completed_at, now())
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'challenge eval briefing failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluate_challenges_briefing ON public.safety_briefing_answers;
CREATE TRIGGER trg_evaluate_challenges_briefing
  AFTER INSERT ON public.safety_briefing_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_evaluate_challenges_on_briefing();

-- -----------------------------------------------------------------------------
-- Auto-pool rotation cron (Chicago ISO week)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rotate_weekly_auto_challenge(
  p_as_of timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start   date;
  v_challenge    text;
  v_active       jsonb;
  v_prev_count   int;
BEGIN
  IF NOT public.are_challenges_enabled() THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'challenges_disabled');
  END IF;

  v_week_start := public.chicago_iso_week_start(p_as_of);

  SELECT gs.value
  INTO v_active
  FROM public.gamification_settings gs
  WHERE gs.key = 'weekly_auto_challenge_active';

  IF v_active IS NOT NULL
     AND jsonb_typeof(v_active) = 'object'
     AND (v_active->>'week_start')::date = v_week_start THEN
    RETURN jsonb_build_object(
      'status', 'already_rotated',
      'week_start', v_week_start,
      'challenge_key', v_active->>'challenge_key'
    );
  END IF;

  SELECT count(*)::int
  INTO v_prev_count
  FROM public.challenge_completions cc
  WHERE cc.window_key = public.weekly_challenge_window_key(v_week_start);

  v_challenge := public.resolve_auto_weekly_challenge(v_week_start);

  IF v_challenge IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'reason', 'empty_pool',
      'week_start', v_week_start
    );
  END IF;

  UPDATE public.gamification_settings
  SET value = jsonb_build_object(
    'week_start', v_week_start,
    'challenge_key', v_challenge
  )
  WHERE key = 'weekly_auto_challenge_active';

  RETURN jsonb_build_object(
    'status', 'rotated',
    'week_start', v_week_start,
    'challenge_key', v_challenge,
    'prior_completions_in_window', v_prev_count
  );
END;
$$;

COMMENT ON FUNCTION public.rotate_weekly_auto_challenge(timestamptz) IS
  'Weekly cron: persist auto-pool selection for chicago_iso_week_start. True no-op when flag off.';

REVOKE ALL ON FUNCTION public.rotate_weekly_auto_challenge(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_weekly_auto_challenge(timestamptz) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-challenge-rotate-utc12') THEN
      PERFORM cron.schedule(
        'gamification-challenge-rotate-utc12',
        '5 12 * * 1',
        $cron$SELECT public.rotate_weekly_auto_challenge();$cron$
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-challenge-rotate-utc11') THEN
      PERFORM cron.schedule(
        'gamification-challenge-rotate-utc11',
        '5 11 * * 1',
        $cron$SELECT public.rotate_weekly_auto_challenge();$cron$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available; skipping challenge rotation schedule: %', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- GRANTS (read helpers for authenticated UI later)
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.weekly_challenge_window_key(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_auto_weekly_challenge(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_challenge_for_activity(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_condition_met(uuid, text, jsonb, text, timestamptz, public.point_source, text, uuid, text) TO service_role;
