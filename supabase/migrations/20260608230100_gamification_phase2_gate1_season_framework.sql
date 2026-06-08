-- =============================================================================
-- Gamification Phase 2 — Gate 1: season framework backend (dark / inert)
-- - seasons table + placeholder season (Braden sets real boundaries pre-kickoff)
-- - point_tx_in_season_window, get_user_season_score, improvement_delta machinery
-- - finalize_season (idempotent) + process_gamification_season_lifecycle cron
-- - Flag helpers: gamification_setting_bool, is_phase2_master_enabled, are_seasons_enabled
-- - D4: extend get_user_lifetime_earned with challenge sources (Phase 1 touch — safe
--   while flag off: no challenge_reward / campaign_multiplier_bonus rows exist yet)
-- Depends on: 20260608230000_gamification_phase2_gate1_enum_extensions.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM: season_status
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.season_status AS ENUM ('draft', 'scheduled', 'active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- TABLE: seasons
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
  season_key             text PRIMARY KEY,
  name                   text NOT NULL,
  theme                  text,
  start_at               timestamptz NOT NULL,
  end_at                 timestamptz NOT NULL,
  status                 public.season_status NOT NULL DEFAULT 'draft',
  most_improved_enabled  boolean NOT NULL DEFAULT false,
  finalized_at           timestamptz,
  sort_order             int NOT NULL DEFAULT 0,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seasons_window_valid CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_seasons_status_window
  ON public.seasons (status, start_at, end_at);

COMMENT ON TABLE public.seasons IS
  'Competitive season windows. Phase 2 — inert until gamification_settings.seasons_enabled is true.';
COMMENT ON COLUMN public.seasons.most_improved_enabled IS
  'When false (Season 1 default), finale emits podium only — no season_most_improved recognition.';
COMMENT ON COLUMN public.seasons.finalized_at IS
  'Set once by finalize_season; guards idempotent re-invocation on cron retry.';

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read seasons" ON public.seasons;
CREATE POLICY "Authenticated read seasons"
  ON public.seasons FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage seasons" ON public.seasons;
CREATE POLICY "Admins manage seasons"
  ON public.seasons TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access seasons" ON public.seasons;
CREATE POLICY "Service role full access seasons"
  ON public.seasons TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- SEED: Phase 2 flags (all false — build dark)
-- -----------------------------------------------------------------------------
INSERT INTO public.gamification_settings (key, value, description) VALUES
  ('phase2_enabled', 'false'::jsonb,
   'Master Phase 2 kill switch — all challenge/season writers no-op when false'),
  ('seasons_enabled', 'false'::jsonb,
   'Season lifecycle, scoring, and finale recognition — off until kickoff'),
  ('challenges_enabled', 'false'::jsonb,
   'Challenge eval + payout writers — off until kickoff (Gate 2+)')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SEED: placeholder season (Braden sets real themed-quarter boundaries pre-kickoff)
-- OPEN ITEM: replace start_at/end_at and theme before seasons_enabled flip.
-- -----------------------------------------------------------------------------
INSERT INTO public.seasons (
  season_key, name, theme, start_at, end_at, status,
  most_improved_enabled, sort_order
) VALUES (
  'season_1_placeholder',
  'Founding Season',
  'generic',
  '2099-01-01 06:00:00+00'::timestamptz,
  '2099-04-01 05:00:00+00'::timestamptz,
  'draft',
  false,
  1
) ON CONFLICT (season_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Flag helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gamification_setting_bool(p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT gs.value
  INTO v_value
  FROM public.gamification_settings gs
  WHERE gs.key = p_key;

  IF v_value IS NULL THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_value) = 'boolean' THEN
    RETURN (v_value #>> '{}')::boolean;
  END IF;

  IF jsonb_typeof(v_value) = 'string' THEN
    RETURN lower(trim(both '"' from v_value::text)) IN ('true', '1', 'yes');
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.gamification_setting_bool(text) IS
  'Reads a boolean gamification_settings flag; false when missing or non-boolean.';

CREATE OR REPLACE FUNCTION public.is_phase2_master_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gamification_setting_bool('phase2_enabled');
$$;

COMMENT ON FUNCTION public.is_phase2_master_enabled() IS
  'Master Phase 2 guard — all Phase 2 paths require this true.';

CREATE OR REPLACE FUNCTION public.are_seasons_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_phase2_master_enabled()
     AND public.gamification_setting_bool('seasons_enabled');
$$;

COMMENT ON FUNCTION public.are_seasons_enabled() IS
  'Season lifecycle, scoring RPCs, and finale — no-op when false.';

CREATE OR REPLACE FUNCTION public.are_challenges_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_phase2_master_enabled()
     AND public.gamification_setting_bool('challenges_enabled');
$$;

COMMENT ON FUNCTION public.are_challenges_enabled() IS
  'Challenge eval + payout writers — no-op when false (Gate 2+).';

-- -----------------------------------------------------------------------------
-- Shared earning-source list (season score + lifetime earned must stay in sync — D4)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gamification_earning_sources()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT ARRAY[
    'announcement_claim',
    'compliance_form',
    'streak_bonus',
    'near_miss_report',
    'certification',
    'manual_award',
    'challenge_reward',
    'campaign_multiplier_bonus'
  ]::text[];
$$;

COMMENT ON FUNCTION public.gamification_earning_sources() IS
  'Positive earning sources for season score and lifetime level progression. Keep in sync.';

-- -----------------------------------------------------------------------------
-- Season window predicate (mirrors raffle-month positive-only filter at season scale)
-- Season boundaries stored as timestamptz (Chicago-midnight encoded as UTC instants).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.point_tx_in_season_window(
  p_amount      integer,
  p_created_at  timestamptz,
  p_start_at    timestamptz,
  p_end_at      timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT p_amount > 0
     AND p_created_at >= p_start_at
     AND p_created_at < p_end_at;
$$;

COMMENT ON FUNCTION public.point_tx_in_season_window(integer, timestamptz, timestamptz, timestamptz) IS
  'Positive-only [start_at, end_at) season window predicate. Does NOT filter counts_toward_raffle.';

-- -----------------------------------------------------------------------------
-- D4: extend get_user_lifetime_earned (deliberate Phase 1-function touch)
-- Behavior-neutral while flag off — no challenge ledger rows exist until kickoff.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_lifetime_earned(
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(pt.amount), 0)::integer
  FROM public.point_transactions pt
  WHERE pt.user_id = target_user_id
    AND pt.amount > 0
    AND pt.source::text = ANY (public.gamification_earning_sources());
$$;

COMMENT ON FUNCTION public.get_user_lifetime_earned(uuid) IS
  'Lifetime earned points for level progression. Includes streak_bonus and Phase 2 challenge sources; excludes redemption and adjustment.';

-- -----------------------------------------------------------------------------
-- Season score RPC (Track A — raw engagement sum; no counts_toward_raffle filter)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_season_score(
  p_user_id    uuid,
  p_season_key text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.are_seasons_enabled() THEN 0
    ELSE COALESCE((
      SELECT SUM(pt.amount)::integer
      FROM public.point_transactions pt
      INNER JOIN public.seasons s ON s.season_key = p_season_key
      WHERE pt.user_id = p_user_id
        AND public.point_tx_in_season_window(pt.amount, pt.created_at, s.start_at, s.end_at)
        AND pt.source::text = ANY (public.gamification_earning_sources())
    ), 0)
  END;
$$;

COMMENT ON FUNCTION public.get_user_season_score(uuid, text) IS
  'Raw season engagement score (Track A). Returns 0 when seasons flag off. No raffle filter.';

-- -----------------------------------------------------------------------------
-- Active season helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_season()
RETURNS TABLE (
  season_key             text,
  name                   text,
  theme                  text,
  start_at               timestamptz,
  end_at                 timestamptz,
  status                 public.season_status,
  most_improved_enabled  boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.season_key,
    s.name,
    s.theme,
    s.start_at,
    s.end_at,
    s.status,
    s.most_improved_enabled
  FROM public.seasons s
  WHERE public.are_seasons_enabled()
    AND s.status = 'active'
    AND s.is_active
  ORDER BY s.start_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_active_season() IS
  'Returns the current active season row, or empty when seasons flag off / none active.';

-- -----------------------------------------------------------------------------
-- Track B machinery: personal baseline + improvement delta
-- Recognition gated by seasons.most_improved_enabled (off for Season 1 — D7).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_season_baseline_score(
  p_user_id    uuid,
  p_season_key text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_start timestamptz;
  v_season_end   timestamptz;
  v_season_days  numeric;
  v_prior_avg    numeric;
  v_cohort       int;
BEGIN
  SELECT s.start_at, s.end_at
  INTO v_season_start, v_season_end
  FROM public.seasons s
  WHERE s.season_key = p_season_key;

  IF v_season_start IS NULL THEN
    RETURN 0;
  END IF;

  v_season_days := GREATEST(
    EXTRACT(EPOCH FROM (v_season_end - v_season_start)) / 86400.0,
    1
  );

  SELECT AVG(public.get_user_season_score(p_user_id, s.season_key))
  INTO v_prior_avg
  FROM public.seasons s
  WHERE s.status = 'closed'
    AND s.season_key <> p_season_key
    AND s.end_at <= v_season_start;

  IF v_prior_avg IS NOT NULL THEN
    RETURN round(v_prior_avg)::integer;
  END IF;

  SELECT gbc.prior_90d_earn
  INTO v_cohort
  FROM public.gamification_baseline_cohort gbc
  WHERE gbc.user_id = p_user_id;

  IF v_cohort IS NOT NULL THEN
    RETURN round(v_cohort * v_season_days / 90.0)::integer;
  END IF;

  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.get_user_season_baseline_score(uuid, text) IS
  'Personal baseline for Most Improved: mean prior closed seasons, else prorated cohort earn.';

CREATE OR REPLACE FUNCTION public.get_user_season_improvement_delta(
  p_user_id    uuid,
  p_season_key text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_season_score(p_user_id, p_season_key)
       - public.get_user_season_baseline_score(p_user_id, p_season_key);
$$;

COMMENT ON FUNCTION public.get_user_season_improvement_delta(uuid, text) IS
  'Track B personal growth delta = current season score minus personal baseline.';

-- -----------------------------------------------------------------------------
-- finalize_season — idempotent via seasons.finalized_at + feed dedupe_key
-- Podium always; Most Improved only when most_improved_enabled (Season 2+).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_season(p_season_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season record;
  v_winner record;
  v_rank int := 0;
  v_payload jsonb;
  v_result jsonb := jsonb_build_object(
    'season_key', p_season_key,
    'status', 'skipped',
    'podium_emitted', 0,
    'most_improved_emitted', false
  );
BEGIN
  IF NOT public.are_seasons_enabled() THEN
    v_result := v_result || jsonb_build_object('reason', 'seasons_disabled');
    RETURN v_result;
  END IF;

  SELECT *
  INTO v_season
  FROM public.seasons s
  WHERE s.season_key = p_season_key
  FOR UPDATE;

  IF v_season IS NULL THEN
    RAISE EXCEPTION 'finalize_season: unknown season_key=%', p_season_key;
  END IF;

  IF v_season.status <> 'closed' THEN
    v_result := v_result || jsonb_build_object('reason', 'season_not_closed');
    RETURN v_result;
  END IF;

  IF v_season.finalized_at IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'status', 'already_finalized',
      'reason', 'idempotent_noop',
      'finalized_at', v_season.finalized_at
    );
    RETURN v_result;
  END IF;

  -- Podium top 3 among competition-eligible users
  FOR v_winner IN
    SELECT ranked.user_id, ranked.season_score, ranked.rank
    FROM (
      SELECT
        au.user_id,
        public.get_user_season_score(au.user_id, p_season_key) AS season_score,
        row_number() OVER (
          ORDER BY public.get_user_season_score(au.user_id, p_season_key) DESC, au.user_id ASC
        ) AS rank
      FROM public.app_users au
      WHERE public.is_competition_eligible(au.user_id)
    ) ranked
    WHERE ranked.season_score > 0
      AND ranked.rank <= 3
    ORDER BY ranked.rank
  LOOP
    v_payload := jsonb_build_object(
      'season_key', p_season_key,
      'rank', v_winner.rank,
      'season_score', v_winner.season_score
    );

    PERFORM public.emit_recognition_event(
      'season_podium',
      v_winner.user_id,
      v_payload,
      'season_podium:' || p_season_key || ':' || v_winner.rank::text || ':' || v_winner.user_id::text
    );

    v_rank := v_rank + 1;
  END LOOP;

  -- Most Improved — only when explicitly enabled (deferred for Season 1 — D7)
  IF v_season.most_improved_enabled THEN
    SELECT ranked.user_id, ranked.improvement_delta, ranked.season_score, ranked.baseline_score
    INTO v_winner
    FROM (
      SELECT
        au.user_id,
        public.get_user_season_improvement_delta(au.user_id, p_season_key) AS improvement_delta,
        public.get_user_season_score(au.user_id, p_season_key) AS season_score,
        public.get_user_season_baseline_score(au.user_id, p_season_key) AS baseline_score
      FROM public.app_users au
      WHERE public.is_competition_eligible(au.user_id)
    ) ranked
    WHERE ranked.improvement_delta > 0
      AND ranked.season_score > 0
    ORDER BY ranked.improvement_delta DESC, ranked.user_id ASC
    LIMIT 1;

    IF v_winner.user_id IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'season_key', p_season_key,
        'delta', v_winner.improvement_delta,
        'current_score', v_winner.season_score,
        'baseline_score', v_winner.baseline_score
      );

      PERFORM public.emit_recognition_event(
        'season_most_improved',
        v_winner.user_id,
        v_payload,
        'season_most_improved:' || p_season_key || ':' || v_winner.user_id::text
      );

      v_result := v_result || jsonb_build_object('most_improved_emitted', true);
    END IF;
  END IF;

  UPDATE public.seasons
  SET finalized_at = now()
  WHERE season_key = p_season_key;

  v_result := v_result || jsonb_build_object(
    'status', 'finalized',
    'podium_emitted', v_rank
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.finalize_season(text) IS
  'Season finale recognition — podium top 3; Most Improved when most_improved_enabled. Idempotent via finalized_at.';

REVOKE ALL ON FUNCTION public.finalize_season(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_season(text) TO service_role;

-- -----------------------------------------------------------------------------
-- Daily lifecycle: scheduled→active, active→closed, finalize once on close
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_gamification_season_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_activated int := 0;
  v_closed int := 0;
  v_finalized jsonb := '[]'::jsonb;
  v_row record;
  v_fin jsonb;
BEGIN
  IF NOT public.are_seasons_enabled() THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'seasons_disabled');
  END IF;

  UPDATE public.seasons s
  SET status = 'active'
  WHERE s.status = 'scheduled'
    AND s.is_active
    AND v_now >= s.start_at
    AND v_now < s.end_at;

  GET DIAGNOSTICS v_activated = ROW_COUNT;

  FOR v_row IN
    UPDATE public.seasons s
    SET status = 'closed'
    WHERE s.status = 'active'
      AND s.is_active
      AND v_now >= s.end_at
    RETURNING s.season_key
  LOOP
    v_closed := v_closed + 1;
    v_fin := public.finalize_season(v_row.season_key);
    v_finalized := v_finalized || jsonb_build_array(v_fin);
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'activated', v_activated,
    'closed', v_closed,
    'finalize_results', v_finalized
  );
END;
$$;

COMMENT ON FUNCTION public.process_gamification_season_lifecycle() IS
  'Daily cron: promote scheduled→active, active→closed, call finalize_season once per close.';

REVOKE ALL ON FUNCTION public.process_gamification_season_lifecycle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_gamification_season_lifecycle() TO service_role;

-- -----------------------------------------------------------------------------
-- pg_cron: daily season lifecycle (6 AM Central ≈ dual UTC slots, like tenure cron)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-season-lifecycle-utc12') THEN
      PERFORM cron.schedule(
        'gamification-season-lifecycle-utc12',
        '0 12 * * *',
        $cron$SELECT public.process_gamification_season_lifecycle();$cron$
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-season-lifecycle-utc11') THEN
      PERFORM cron.schedule(
        'gamification-season-lifecycle-utc11',
        '0 11 * * *',
        $cron$SELECT public.process_gamification_season_lifecycle();$cron$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available; skipping gamification season lifecycle schedule: %', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- GRANTS
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.gamification_setting_bool(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_phase2_master_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_seasons_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_challenges_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gamification_earning_sources() TO authenticated;
GRANT EXECUTE ON FUNCTION public.point_tx_in_season_window(integer, timestamptz, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_season_score(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_season() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_season_baseline_score(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_season_improvement_delta(uuid, text) TO authenticated;
