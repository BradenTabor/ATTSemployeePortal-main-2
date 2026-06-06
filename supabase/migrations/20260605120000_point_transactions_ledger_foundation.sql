-- =============================================================================
-- Points System v2 — Phase 1 increment: ledger foundation
-- - point_source enum + point_transactions ledger (§2.1)
-- - get_user_point_balance / get_user_raffle_entries (§3)
-- - RLS on point_transactions (§4)
-- - Dual-write triggers on announcement_rewards / compliance_rewards (§5 Phase C)
-- - Idempotent backfill from existing reward rows (§5 Phase B)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM: point_source
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.point_source AS ENUM (
    'announcement_claim',
    'compliance_form',
    'streak_bonus',
    'near_miss_report',
    'certification',
    'manual_award',
    'redemption',
    'adjustment'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- TABLE: point_transactions (append-only ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount              integer NOT NULL,
  source              public.point_source NOT NULL,
  reference_id        uuid,
  reference_table     text,
  counts_toward_raffle boolean NOT NULL DEFAULT true,
  category            text,
  reason              text,
  awarded_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- CHECK constraints (idempotent — safe if table already existed without them)
DO $$ BEGIN
  ALTER TABLE public.point_transactions
    ADD CONSTRAINT manual_award_requires_reason
    CHECK (source <> 'manual_award' OR (reason IS NOT NULL AND awarded_by IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.point_transactions
    ADD CONSTRAINT redemption_is_negative
    CHECK (source <> 'redemption' OR amount < 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.point_transactions IS
  'Append-only points ledger — single source of truth for wallet balance and raffle entries.';

-- Idempotency for automatic sources: never double-credit the same source row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_source_ref
  ON public.point_transactions(source, reference_id)
  WHERE reference_id IS NOT NULL
    AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report');

CREATE INDEX IF NOT EXISTS idx_point_tx_user
  ON public.point_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_point_tx_user_time
  ON public.point_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_point_tx_raffle
  ON public.point_transactions(user_id, created_at)
  WHERE counts_toward_raffle;

CREATE INDEX IF NOT EXISTS idx_point_tx_source
  ON public.point_transactions(source);

-- -----------------------------------------------------------------------------
-- RLS: point_transactions (§4)
-- -----------------------------------------------------------------------------
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own point transactions" ON public.point_transactions;
CREATE POLICY "Users can read own point transactions"
  ON public.point_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all point transactions" ON public.point_transactions;
CREATE POLICY "Admins can read all point transactions"
  ON public.point_transactions FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access point transactions" ON public.point_transactions;
CREATE POLICY "Service role full access point transactions"
  ON public.point_transactions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- FUNCTIONS: balance helpers (§3)
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
  WHERE user_id = target_user_id;
$$;

COMMENT ON FUNCTION public.get_user_point_balance(uuid) IS
  'Returns spendable wallet balance (SUM of all ledger amounts) for a user.';

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
    AND counts_toward_raffle
    AND amount > 0
    AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'America/Chicago')) = p_year
    AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'America/Chicago')) = p_month;
$$;

COMMENT ON FUNCTION public.get_user_raffle_entries(uuid, int, int) IS
  'Returns raffle-eligible positive ledger sum for a user in a calendar month (America/Chicago).';

GRANT EXECUTE ON FUNCTION public.get_user_point_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_raffle_entries(uuid, int, int) TO authenticated;

-- -----------------------------------------------------------------------------
-- DUAL-WRITE: AFTER INSERT triggers (§5 Phase C)
-- Shared idempotency predicate matches uq_point_tx_source_ref exactly.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_announcement_reward_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Zero-point rows carry no wallet/raffle value; skip ledger insert (still let source insert succeed).
  IF NEW.points_awarded = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
  VALUES
    (NEW.user_id, NEW.points_awarded, 'announcement_claim', NEW.id, 'announcement_rewards', true, NEW.claimed_at)
  ON CONFLICT (source, reference_id)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_compliance_reward_to_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Zero-point rows carry no wallet/raffle value; skip ledger insert (still let source insert succeed).
  IF NEW.points_awarded = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
  VALUES
    (NEW.user_id, NEW.points_awarded, 'compliance_form', NEW.id, 'compliance_rewards', true, NEW.awarded_at)
  ON CONFLICT (source, reference_id)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;

  RETURN NEW;
END;
$$;

-- postgres owner + SECURITY DEFINER so trigger INSERT bypasses point_transactions RLS
ALTER FUNCTION public.sync_announcement_reward_to_ledger() OWNER TO postgres;
ALTER FUNCTION public.sync_compliance_reward_to_ledger() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_sync_announcement_reward_to_ledger ON public.announcement_rewards;
CREATE TRIGGER trg_sync_announcement_reward_to_ledger
  AFTER INSERT ON public.announcement_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_announcement_reward_to_ledger();

DROP TRIGGER IF EXISTS trg_sync_compliance_reward_to_ledger ON public.compliance_rewards;
CREATE TRIGGER trg_sync_compliance_reward_to_ledger
  AFTER INSERT ON public.compliance_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_compliance_reward_to_ledger();

-- -----------------------------------------------------------------------------
-- BACKFILL: existing reward rows → ledger (§5 Phase B, idempotent)
-- ON CONFLICT predicate must match uq_point_tx_source_ref exactly.
-- Zero-point source rows are excluded — they add nothing to wallet/raffle sums.
-- -----------------------------------------------------------------------------
INSERT INTO public.point_transactions
  (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
SELECT
  user_id,
  points_awarded,
  'announcement_claim',
  id,
  'announcement_rewards',
  true,
  claimed_at
FROM public.announcement_rewards
WHERE points_awarded <> 0
ON CONFLICT (source, reference_id)
  WHERE reference_id IS NOT NULL
    AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
DO NOTHING;

INSERT INTO public.point_transactions
  (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
SELECT
  user_id,
  points_awarded,
  'compliance_form',
  id,
  'compliance_rewards',
  true,
  awarded_at
FROM public.compliance_rewards
WHERE points_awarded <> 0
ON CONFLICT (source, reference_id)
  WHERE reference_id IS NOT NULL
    AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
DO NOTHING;

-- -----------------------------------------------------------------------------
-- CLEANUP: remove zero-amount ledger rows inserted by the pre-amendment backfill.
-- Scoped EXACTLY to the two automatic sources that previously mirrored zero rows.
-- Defensive: never touches manual_award / redemption / adjustment / streak_bonus /
-- near_miss_report / certification rows. Idempotent (no-op once clean).
-- Does NOT touch the source compliance_rewards table — its zero rows stay as-is.
-- -----------------------------------------------------------------------------
DELETE FROM public.point_transactions
WHERE amount = 0
  AND source IN ('announcement_claim', 'compliance_form');
