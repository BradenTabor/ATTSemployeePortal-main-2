-- =============================================================================
-- Option A — Raffle ledger cutover
-- - Streak bonus writer (ledger rows; raffle-only, not wallet)
-- - Shared raffle-month predicate (point_tx_matches_raffle_month)
-- - Wallet exclusion for streak_bonus; wallet breakdown alignment
-- - Repurpose get_monthly_raffle_stats to ledger pool totals
-- KEEP IN SYNC streak amounts: src/lib/streakCalculation.ts STREAK_BONUSES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shared raffle-month predicate — single source; DO NOT duplicate inline elsewhere.
-- Used by: get_user_raffle_entries, get_monthly_raffle_stats,
--          get_user_raffle_entries_by_source (gate asserts all reference this).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.point_tx_matches_raffle_month(
  p_counts_toward_raffle boolean,
  p_amount integer,
  p_created_at timestamptz,
  p_year int,
  p_month int
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT p_counts_toward_raffle
     AND p_amount > 0
     AND EXTRACT(YEAR FROM (p_created_at AT TIME ZONE 'America/Chicago')) = p_year
     AND EXTRACT(MONTH FROM (p_created_at AT TIME ZONE 'America/Chicago')) = p_month;
$$;

COMMENT ON FUNCTION public.point_tx_matches_raffle_month(boolean, integer, timestamptz, integer, integer) IS
  'Shared raffle eligibility + America/Chicago month filter. '
  'Must stay identical across get_user_raffle_entries and get_monthly_raffle_stats.';

-- -----------------------------------------------------------------------------
-- Streak constants (KEEP IN SYNC: STREAK_BONUSES in streakCalculation.ts)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.streak_bonus_amount(p_milestone_key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_milestone_key
    WHEN 'consecutive_5'  THEN 2
    WHEN 'consecutive_10' THEN 5
    WHEN 'full_month'     THEN 15
    ELSE NULL
  END;
$$;

-- -----------------------------------------------------------------------------
-- Streak milestone compute (authoritative; gate-tested vs TS fixtures)
-- Walks p_announcement_dates in order; same semantics as calculateStreakBonuses.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_streak_milestones(
  p_claimed_dates date[],
  p_announcement_dates date[]
)
RETURNS TABLE(milestone_key text, bonus_amount integer, completion_date date)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_ann date;
  v_current_streak int := 0;
  v_milestones_hit int[] := ARRAY[]::int[];
  v_all_claimed boolean;
  v_last_ann date;
BEGIN
  IF p_announcement_dates IS NULL OR array_length(p_announcement_dates, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_ann IN ARRAY p_announcement_dates
  LOOP
    IF p_claimed_dates IS NOT NULL AND v_ann = ANY(p_claimed_dates) THEN
      v_current_streak := v_current_streak + 1;

      IF v_current_streak = 5 AND NOT (5 = ANY(v_milestones_hit)) THEN
        milestone_key := 'consecutive_5';
        bonus_amount := public.streak_bonus_amount('consecutive_5');
        completion_date := v_ann;
        RETURN NEXT;
        v_milestones_hit := array_append(v_milestones_hit, 5);
      END IF;

      IF v_current_streak = 10 AND NOT (10 = ANY(v_milestones_hit)) THEN
        milestone_key := 'consecutive_10';
        bonus_amount := public.streak_bonus_amount('consecutive_10');
        completion_date := v_ann;
        RETURN NEXT;
        v_milestones_hit := array_append(v_milestones_hit, 10);
      END IF;
    ELSE
      v_current_streak := 0;
    END IF;
  END LOOP;

  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(p_announcement_dates) AS ad(d)
    WHERE p_claimed_dates IS NULL OR NOT (ad.d = ANY(p_claimed_dates))
  ) INTO v_all_claimed;

  IF v_all_claimed THEN
    v_last_ann := p_announcement_dates[array_length(p_announcement_dates, 1)];
    milestone_key := 'full_month';
    bonus_amount := public.streak_bonus_amount('full_month');
    completion_date := v_last_ann;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_streak_bonus_total(
  p_claimed_dates date[],
  p_announcement_dates date[]
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(m.bonus_amount), 0)::integer
  FROM public.compute_streak_milestones(p_claimed_dates, p_announcement_dates) AS m;
$$;

COMMENT ON FUNCTION public.compute_streak_milestones(date[], date[]) IS
  'KEEP IN SYNC: calculateStreakBonuses in src/lib/streakCalculation.ts '
  'and supabase/functions/_shared/streakCalculation.ts';

-- -----------------------------------------------------------------------------
-- Streak bonus ledger writer
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_streak_bonuses_for_user(
  p_user_id uuid,
  p_anchor_claimed_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_month int;
  v_month_key text;
  v_start date;
  v_end date;
  v_ann_dates date[];
  v_claimed_dates date[];
  v_m record;
  v_created_at timestamptz;
  v_category text;
BEGIN
  v_year := EXTRACT(YEAR FROM (p_anchor_claimed_at AT TIME ZONE 'America/Chicago'))::int;
  v_month := EXTRACT(MONTH FROM (p_anchor_claimed_at AT TIME ZONE 'America/Chicago'))::int;
  v_month_key := v_year::text || '-' || lpad(v_month::text, 2, '0');
  v_start := make_date(v_year, v_month, 1);
  v_end := (v_start + interval '1 month')::date;

  SELECT COALESCE(array_agg(sub.d ORDER BY sub.d), ARRAY[]::date[])
  INTO v_ann_dates
  FROM (
    SELECT DISTINCT a.date AS d
    FROM public.announcements a
    WHERE a.date >= v_start AND a.date < v_end
  ) sub;

  SELECT COALESCE(array_agg(sub.d ORDER BY sub.d), ARRAY[]::date[])
  INTO v_claimed_dates
  FROM (
    SELECT DISTINCT (ar.claimed_at AT TIME ZONE 'America/Chicago')::date AS d
    FROM public.announcement_rewards ar
    WHERE ar.user_id = p_user_id
      AND (ar.claimed_at AT TIME ZONE 'America/Chicago')::date >= v_start
      AND (ar.claimed_at AT TIME ZONE 'America/Chicago')::date < v_end
  ) sub;

  FOR v_m IN
    SELECT * FROM public.compute_streak_milestones(v_claimed_dates, v_ann_dates)
  LOOP
    v_category := v_m.milestone_key || ':' || v_month_key;

    SELECT ar.claimed_at
    INTO v_created_at
    FROM public.announcement_rewards ar
    WHERE ar.user_id = p_user_id
      AND (ar.claimed_at AT TIME ZONE 'America/Chicago')::date = v_m.completion_date
    ORDER BY ar.claimed_at DESC
    LIMIT 1;

    IF v_created_at IS NULL THEN
      RAISE EXCEPTION 'sync_streak_bonuses_for_user: no claim_at for completion_date %', v_m.completion_date;
    END IF;

    INSERT INTO public.point_transactions (
      user_id, amount, source, reference_table, counts_toward_raffle, category, created_at
    )
    VALUES (
      p_user_id,
      v_m.bonus_amount,
      'streak_bonus',
      'announcement_streak',
      true,
      v_category,
      v_created_at
    )
    ON CONFLICT (user_id, source, category)
      WHERE source = 'streak_bonus'
    DO NOTHING;
  END LOOP;
END;
$$;

ALTER FUNCTION public.sync_streak_bonuses_for_user(uuid, timestamptz) OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_streak_bonus
  ON public.point_transactions (user_id, source, category)
  WHERE source = 'streak_bonus';

CREATE OR REPLACE FUNCTION public.trg_sync_streak_bonus_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_streak_bonuses_for_user(NEW.user_id, NEW.claimed_at);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_sync_streak_bonus_to_ledger() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_sync_streak_bonus_to_ledger ON public.announcement_rewards;
CREATE TRIGGER trg_sync_streak_bonus_to_ledger
  AFTER INSERT ON public.announcement_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_streak_bonus_to_ledger();

-- -----------------------------------------------------------------------------
-- Wallet: exclude raffle-only streak_bonus
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_point_balance(target_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.point_transactions
  WHERE user_id = target_user_id
    AND source <> 'streak_bonus';
$$;

COMMENT ON FUNCTION public.get_user_point_balance(uuid) IS
  'Spendable wallet balance (SUM of ledger amounts excluding streak_bonus raffle-only rows).';

-- -----------------------------------------------------------------------------
-- Raffle entries — uses shared predicate (see point_tx_matches_raffle_month)
-- Cross-ref: get_monthly_raffle_stats must use the same filter.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_raffle_entries(
  target_user_id uuid,
  p_year int,
  p_month int
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.point_transactions
  WHERE user_id = target_user_id
    AND public.point_tx_matches_raffle_month(
      counts_toward_raffle, amount, created_at, p_year, p_month
    );
$$;

COMMENT ON FUNCTION public.get_user_raffle_entries(uuid, int, int) IS
  'Raffle-eligible positive ledger sum for a user in a Chicago calendar month. '
  'Predicate: point_tx_matches_raffle_month — keep in sync with get_monthly_raffle_stats.';

-- -----------------------------------------------------------------------------
-- Repurpose pool stats — ledger-native (same predicate as get_user_raffle_entries)
-- Cross-ref: get_user_raffle_entries must use the same filter.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_raffle_stats(p_year int, p_month int)
RETURNS TABLE(total_participants bigint, total_claim_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT user_id)::bigint,
    COALESCE(SUM(amount), 0)::bigint
  FROM public.point_transactions
  WHERE public.point_tx_matches_raffle_month(
    counts_toward_raffle, amount, created_at, p_year, p_month
  );
$$;

COMMENT ON FUNCTION public.get_monthly_raffle_stats(int, int) IS
  'Ledger-native monthly raffle pool: distinct users + SUM(entries). '
  'total_claim_count is pool entry sum (not raw claim count). '
  'Predicate: point_tx_matches_raffle_month — keep in sync with get_user_raffle_entries.';

-- -----------------------------------------------------------------------------
-- Wallet breakdown — excludes streak_bonus (matches get_user_point_balance)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_points_by_source(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(source public.point_source, category text, total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user uuid;
BEGIN
  IF target_user_id IS NULL THEN
    v_effective_user := auth.uid();
  ELSIF public.is_admin() OR target_user_id = auth.uid() THEN
    v_effective_user := target_user_id;
  ELSE
    RAISE EXCEPTION 'Not permitted to view points for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pt.source,
    pt.category,
    COALESCE(SUM(pt.amount), 0)::integer AS total
  FROM public.point_transactions pt
  WHERE pt.user_id = v_effective_user
    AND pt.source <> 'streak_bonus'
  GROUP BY pt.source, pt.category
  ORDER BY pt.source, pt.category NULLS FIRST;
END;
$$;

COMMENT ON FUNCTION public.get_user_points_by_source(uuid) IS
  'Wallet breakdown grouped by source/category (excludes streak_bonus raffle-only rows). '
  'SUM(total) reconciles to get_user_point_balance.';

-- -----------------------------------------------------------------------------
-- Raffle breakdown for current month (includes streak_bonus)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_raffle_entries_by_source(
  target_user_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE(source public.point_source, category text, total integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_user uuid;
BEGIN
  IF target_user_id IS NULL THEN
    v_effective_user := auth.uid();
  ELSIF public.is_admin() OR target_user_id = auth.uid() THEN
    v_effective_user := target_user_id;
  ELSE
    RAISE EXCEPTION 'Not permitted to view raffle entries for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pt.source,
    pt.category,
    COALESCE(SUM(pt.amount), 0)::integer AS total
  FROM public.point_transactions pt
  WHERE pt.user_id = v_effective_user
    AND public.point_tx_matches_raffle_month(
      pt.counts_toward_raffle, pt.amount, pt.created_at, p_year, p_month
    )
  GROUP BY pt.source, pt.category
  ORDER BY pt.source, pt.category NULLS FIRST;
END;
$$;

COMMENT ON FUNCTION public.get_user_raffle_entries_by_source(uuid, int, int) IS
  'Raffle-eligible ledger breakdown for a Chicago month (includes streak_bonus). '
  'SUM(total) reconciles to get_user_raffle_entries.';

GRANT EXECUTE ON FUNCTION public.get_user_raffle_entries_by_source(uuid, int, int) TO authenticated;

-- -----------------------------------------------------------------------------
-- Current-month backfill (claim-dated created_at; no prior months)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_chicago timestamp := now() AT TIME ZONE 'America/Chicago';
  v_year int := EXTRACT(YEAR FROM v_chicago)::int;
  v_month int := EXTRACT(MONTH FROM v_chicago)::int;
BEGIN
  FOR r IN
    SELECT ar.user_id, MAX(ar.claimed_at) AS latest_claim
    FROM public.announcement_rewards ar
    WHERE EXTRACT(YEAR FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')) = v_year
      AND EXTRACT(MONTH FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')) = v_month
    GROUP BY ar.user_id
  LOOP
    PERFORM public.sync_streak_bonuses_for_user(r.user_id, r.latest_claim);
  END LOOP;
END $$;
