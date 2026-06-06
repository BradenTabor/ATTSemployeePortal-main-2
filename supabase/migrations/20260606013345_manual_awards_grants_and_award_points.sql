-- =============================================================================
-- Points System v2 — Increment 2a: Manual Awards (DB + permissions + RPC)
-- - point_awarder_grants table + one-active-grant-per-user index (§2.2)
-- - point_transactions.request_id + manual_award idempotency index
-- - can_award_points() permission predicate (§3)
-- - award_points() SECURITY DEFINER RPC with full enforcement matrix (§3, §4)
-- - RLS on point_awarder_grants (admin-managed; self/admin readable) (§4)
--
-- Scope is COMPANY-WIDE: a granted awarder may award any valid app_user (no crew
-- check). Admins bypass per-award cap and monthly budget. Granted non-admins are
-- bounded by their grant. Self-awards forbidden. Manual awards feed the raffle
-- (counts_toward_raffle = true). Monthly budget window = calendar month in
-- America/Chicago (matches get_user_raffle_entries TZ convention).
--
-- point_transactions RLS is UNCHANGED: no direct user INSERT policy is added.
-- Manual awards are written ONLY through award_points (SECURITY DEFINER).
-- Fully idempotent: guarded constraints, IF NOT EXISTS, DROP POLICY IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: point_awarder_grants (§2.2)
-- One row per user that has been granted award authority. Revocation is a soft
-- update (revoked_at / revoked_by), never a delete, to preserve the audit trail.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.point_awarder_grants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by     uuid REFERENCES auth.users(id),
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES auth.users(id),
  per_award_cap  integer NOT NULL DEFAULT 25,
  monthly_budget integer NOT NULL DEFAULT 500,
  note           text
);

DO $$ BEGIN
  ALTER TABLE public.point_awarder_grants
    ADD CONSTRAINT point_awarder_grants_caps_positive
    CHECK (per_award_cap > 0 AND monthly_budget > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.point_awarder_grants IS
  'Authority to manually award points. One ACTIVE grant per user (revoked_at IS NULL). '
  'Admins do not need a grant and bypass cap/budget.';

-- One ACTIVE grant per user; revoked rows are exempt so history accumulates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_grant_per_user
  ON public.point_awarder_grants(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_point_awarder_grants_user
  ON public.point_awarder_grants(user_id);

-- -----------------------------------------------------------------------------
-- point_transactions: manual-award idempotency key
-- uq_point_tx_source_ref does NOT cover manual_award (manual_award isn't in its
-- source list and reference_id is null), so manual awards need their own key.
-- -----------------------------------------------------------------------------
ALTER TABLE public.point_transactions
  ADD COLUMN IF NOT EXISTS request_id uuid;

COMMENT ON COLUMN public.point_transactions.request_id IS
  'Client-supplied idempotency key for manual_award rows. A duplicate award_points '
  'call with the same request_id is a no-op that returns the original tx id.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_manual_request
  ON public.point_transactions(request_id)
  WHERE source = 'manual_award' AND request_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- FUNCTION: can_award_points(actor) (§3)
-- True if the current user is an admin OR the actor has an active grant.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_award_points(actor uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF actor IS NULL THEN
    RETURN false;
  END IF;

  -- Admins may always award (no grant required).
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- Otherwise require an active (non-revoked) grant for the actor.
  RETURN EXISTS (
    SELECT 1
    FROM public.point_awarder_grants g
    WHERE g.user_id = actor
      AND g.revoked_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.can_award_points(uuid) IS
  'Returns true if the caller is an admin OR the actor holds an active point-awarder grant.';

GRANT EXECUTE ON FUNCTION public.can_award_points(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: award_points(...) (§3, §4)
-- Single, self-gating entry point for manual awards. SECURITY DEFINER so the
-- ledger INSERT bypasses point_transactions RLS (no user INSERT policy exists).
-- Enforcement order: permission -> recipient -> self -> amount -> reason ->
-- category -> (idempotent retry short-circuit) -> cap/budget (non-admin) ->
-- idempotent insert. Returns the manual_award transaction id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.award_points(
  p_recipient  uuid,
  p_amount     integer,
  p_category   text,
  p_reason     text,
  p_request_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_reason      text := btrim(coalesce(p_reason, ''));
  v_grant       public.point_awarder_grants;
  v_month_total integer;
  v_tx_id       uuid;
  -- Allowed categories validated in-function so the list is editable without a migration.
  v_categories  text[] := ARRAY[
    'maintenance', 'good_performance', 'safety_catch',
    'attendance', 'peer_recognition', 'other'
  ];
BEGIN
  -- (a) Permission.
  IF NOT public.can_award_points(v_actor) THEN
    RAISE EXCEPTION 'Not permitted to award points';
  END IF;

  -- (b) Recipient must be a real app_users row.
  IF NOT EXISTS (SELECT 1 FROM public.app_users au WHERE au.user_id = p_recipient) THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;

  -- (c) No self-awards.
  IF p_recipient = v_actor THEN
    RAISE EXCEPTION 'Cannot award points to yourself';
  END IF;

  -- (d) Positive amount.
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- (e) Reason required (non-empty after trim).
  IF v_reason = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  -- (f) Category in the allowed set.
  IF p_category IS NULL OR NOT (p_category = ANY (v_categories)) THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;

  -- A request id is mandatory: it is the idempotency key for manual awards.
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  -- Idempotent retry short-circuit: an identical (same request_id) submission is
  -- a no-op that returns the original tx id. Placed BEFORE cap/budget so a
  -- double-tap can never error on budget by double-counting its own first insert.
  SELECT pt.id INTO v_tx_id
  FROM public.point_transactions pt
  WHERE pt.source = 'manual_award'
    AND pt.request_id = p_request_id;
  IF v_tx_id IS NOT NULL THEN
    RETURN v_tx_id;
  END IF;

  -- (g) Non-admins are bounded by their grant. Admins skip cap + budget entirely.
  IF NOT public.is_admin() THEN
    SELECT * INTO v_grant
    FROM public.point_awarder_grants g
    WHERE g.user_id = v_actor
      AND g.revoked_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      -- Defensive: can_award_points passed but no active grant (shouldn't happen).
      RAISE EXCEPTION 'Not permitted to award points';
    END IF;

    IF p_amount > v_grant.per_award_cap THEN
      RAISE EXCEPTION 'Exceeds per-award cap of %', v_grant.per_award_cap;
    END IF;

    -- This awarder's manual_award total for the current calendar month (America/Chicago).
    SELECT COALESCE(SUM(pt.amount), 0)::integer INTO v_month_total
    FROM public.point_transactions pt
    WHERE pt.source = 'manual_award'
      AND pt.awarded_by = v_actor
      AND EXTRACT(YEAR FROM (pt.created_at AT TIME ZONE 'America/Chicago'))
            = EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Chicago'))
      AND EXTRACT(MONTH FROM (pt.created_at AT TIME ZONE 'America/Chicago'))
            = EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'));

    IF v_month_total + p_amount > v_grant.monthly_budget THEN
      RAISE EXCEPTION 'Exceeds monthly budget of %', v_grant.monthly_budget;
    END IF;
  END IF;

  -- (h) Idempotent insert. ON CONFLICT on the manual-award request_id partial
  -- unique index guards against a concurrent double-submit race.
  INSERT INTO public.point_transactions
    (user_id, amount, source, counts_toward_raffle, category, reason, awarded_by, request_id)
  VALUES
    (p_recipient, p_amount, 'manual_award', true, p_category, v_reason, v_actor, p_request_id)
  ON CONFLICT (request_id) WHERE source = 'manual_award' AND request_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_tx_id;

  -- Lost the race (row already existed): return the existing tx id.
  IF v_tx_id IS NULL THEN
    SELECT pt.id INTO v_tx_id
    FROM public.point_transactions pt
    WHERE pt.source = 'manual_award'
      AND pt.request_id = p_request_id;
  END IF;

  RETURN v_tx_id;
END;
$$;

COMMENT ON FUNCTION public.award_points(uuid, integer, text, text, uuid) IS
  'Manual point award entry point. Self-gating (permission, recipient, self, amount, '
  'reason, category, cap/budget for non-admins) and idempotent on p_request_id. '
  'Writes a manual_award ledger row (counts_toward_raffle = true) and returns its tx id.';

-- Owner = postgres so SECURITY DEFINER bodies bypass RLS on point_transactions /
-- point_awarder_grants (matches the foundation migration's deliberate pattern).
ALTER FUNCTION public.can_award_points(uuid) OWNER TO postgres;
ALTER FUNCTION public.award_points(uuid, integer, text, text, uuid) OWNER TO postgres;

-- Function gates itself; do not rely on RLS for the insert.
GRANT EXECUTE ON FUNCTION public.award_points(uuid, integer, text, text, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS: point_awarder_grants (§4)
-- Only admins may grant / set cap+budget / revoke. Users may read their own
-- grant; admins read all; service_role full access.
-- point_transactions RLS is intentionally NOT modified here.
-- -----------------------------------------------------------------------------
ALTER TABLE public.point_awarder_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage awarder grants insert" ON public.point_awarder_grants;
CREATE POLICY "Admins manage awarder grants insert"
  ON public.point_awarder_grants FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage awarder grants update" ON public.point_awarder_grants;
CREATE POLICY "Admins manage awarder grants update"
  ON public.point_awarder_grants FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users read own awarder grant" ON public.point_awarder_grants;
CREATE POLICY "Users read own awarder grant"
  ON public.point_awarder_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Service role full access awarder grants" ON public.point_awarder_grants;
CREATE POLICY "Service role full access awarder grants"
  ON public.point_awarder_grants FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Table-level privileges so RLS (not a missing grant) is the actual gate.
-- No DELETE for authenticated: revocation is a soft UPDATE (revoked_at).
GRANT SELECT, INSERT, UPDATE ON public.point_awarder_grants TO authenticated;
GRANT ALL ON public.point_awarder_grants TO service_role;
