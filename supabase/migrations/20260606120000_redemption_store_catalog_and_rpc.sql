-- =============================================================================
-- Points System v2 — Increment 3: Redemption Store (DB + RPC + fulfillment)
-- - reward_catalog table (§2.3)
-- - redemptions table + redemption_status enum (§2.4)
-- - redeem_reward() hold-on-request RPC with idempotency + race-safe stock/balance
-- - fulfill_redemption / deny_redemption / cancel_redemption state machine
-- - RLS: catalog read (active items); redemptions read-only for users; writes via RPC
--
-- Spend draws down lifetime wallet (get_user_point_balance) but NOT monthly raffle
-- entries: hold rows and refund adjustments use counts_toward_raffle = FALSE.
-- point_transactions RLS is UNCHANGED (no user-INSERT policy).
-- Fully idempotent: IF NOT EXISTS, guarded constraints, DROP POLICY IF EXISTS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUM: redemption_status (§2.4)
-- Flow: pending -> fulfilled | denied | canceled. 'approved' reserved for future use.
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.redemption_status AS ENUM (
    'pending',
    'approved',
    'fulfilled',
    'denied',
    'canceled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- TABLE: reward_catalog (§2.3)
-- stock_qty NULL = unlimited inventory.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_catalog (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  image_url    text,
  point_cost   integer NOT NULL,
  stock_qty    integer,
  category     text,
  is_active    boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.reward_catalog
    ADD CONSTRAINT reward_catalog_point_cost_positive
    CHECK (point_cost > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.reward_catalog
    ADD CONSTRAINT reward_catalog_stock_qty_nonnegative
    CHECK (stock_qty IS NULL OR stock_qty >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.reward_catalog IS
  'Redemption store catalog. stock_qty NULL = unlimited. Writes admin-only via RLS.';

CREATE INDEX IF NOT EXISTS idx_reward_catalog_active_sort
  ON public.reward_catalog(is_active, sort_order)
  WHERE is_active;

-- -----------------------------------------------------------------------------
-- TABLE: redemptions (§2.4)
-- request_id is the client idempotency key for redeem_reward().
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.redemptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id           uuid NOT NULL REFERENCES public.reward_catalog(id),
  point_cost        integer NOT NULL,
  status            public.redemption_status NOT NULL DEFAULT 'pending',
  request_id        uuid NOT NULL,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  decided_by        uuid REFERENCES auth.users(id),
  decided_at        timestamptz,
  fulfillment_note  text
);

DO $$ BEGIN
  ALTER TABLE public.redemptions
    ADD CONSTRAINT redemptions_point_cost_positive
    CHECK (point_cost > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.redemptions IS
  'Redemption requests. Points are held on request (pending). Status transitions '
  'via SECURITY DEFINER RPCs only — no direct user INSERT/UPDATE.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_redemptions_user_request
  ON public.redemptions(user_id, request_id);

CREATE INDEX IF NOT EXISTS idx_redemptions_user
  ON public.redemptions(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_redemptions_status
  ON public.redemptions(status, requested_at DESC);

-- One hold row and one refund adjustment per redemption (idempotent deny/cancel).
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_redemption_hold
  ON public.point_transactions(reference_id)
  WHERE source = 'redemption' AND reference_table = 'redemptions';

CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_redemption_refund
  ON public.point_transactions(reference_id)
  WHERE source = 'adjustment' AND reference_table = 'redemptions';

-- -----------------------------------------------------------------------------
-- FUNCTION: redeem_reward(p_item_id, p_request_id) (§3)
-- Hold-on-request: deducts wallet via negative redemption ledger row immediately.
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

  -- Serialize all redeems for this user so balance read + hold insert are atomic.
  -- Closes the TOCTOU window: two concurrent redeems cannot both pass a balance
  -- check against the same pre-hold balance.
  PERFORM pg_advisory_xact_lock(hashtext('redeem_reward:' || v_user::text));

  -- (a) Idempotency: double-submit returns the same redemption, no second hold.
  SELECT r.id INTO v_existing
  FROM public.redemptions r
  WHERE r.user_id = v_user AND r.request_id = p_request_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- (b) Load item FOR UPDATE (serializes catalog row for stock checks).
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

  -- (c) Race-safe stock: atomic decrement with guard; two concurrent buyers of the
  -- last unit — only one UPDATE ... WHERE stock_qty > 0 succeeds.
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

  -- (d) Balance check under per-user advisory lock (anti double-spend).
  v_balance := public.get_user_point_balance(v_user);
  IF v_balance < v_item.point_cost THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- (e) Insert redemption request (pending).
  INSERT INTO public.redemptions
    (user_id, item_id, point_cost, status, request_id)
  VALUES
    (v_user, p_item_id, v_item.point_cost, 'pending', p_request_id)
  RETURNING id INTO v_redemption_id;

  -- (f) Insert hold: negative redemption row; does NOT count toward raffle.
  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle)
  VALUES
    (v_user, -v_item.point_cost, 'redemption', v_redemption_id, 'redemptions', false);

  RETURN v_redemption_id;

EXCEPTION
  WHEN unique_violation THEN
    -- Lost idempotency race on (user_id, request_id): return the winner's row.
    SELECT r.id INTO v_existing
    FROM public.redemptions r
    WHERE r.user_id = v_user AND r.request_id = p_request_id;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.redeem_reward(uuid, uuid) IS
  'Redeem a catalog item. Idempotent on p_request_id. Deducts wallet immediately '
  '(negative redemption hold, counts_toward_raffle=false). Race-safe stock + balance.';

ALTER FUNCTION public.redeem_reward(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Internal: idempotent refund + stock restore for pending -> denied/canceled.
-- Not granted to authenticated — only called by deny/cancel RPCs.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._refund_redemption_hold(
  p_redemption public.redemptions,
  p_reason     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, reason)
  VALUES
    (p_redemption.user_id, p_redemption.point_cost, 'adjustment',
     p_redemption.id, 'redemptions', false, p_reason)
  ON CONFLICT (reference_id)
    WHERE source = 'adjustment' AND reference_table = 'redemptions'
  DO NOTHING;

  UPDATE public.reward_catalog rc
  SET stock_qty = rc.stock_qty + 1,
      updated_at = now()
  WHERE rc.id = p_redemption.item_id
    AND rc.stock_qty IS NOT NULL;
END;
$$;

ALTER FUNCTION public._refund_redemption_hold(public.redemptions, text) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- FUNCTION: fulfill_redemption — admin only; pending -> fulfilled; no refund.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_redemption(
  p_redemption_id uuid,
  p_note          text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_redemption public.redemptions;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not permitted to fulfill redemptions';
  END IF;

  SELECT * INTO v_redemption
  FROM public.redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_redemption.status <> 'pending' THEN
    RAISE EXCEPTION 'Invalid transition: cannot fulfill % redemption', v_redemption.status;
  END IF;

  UPDATE public.redemptions
  SET status = 'fulfilled',
      decided_by = v_actor,
      decided_at = now(),
      fulfillment_note = p_note
  WHERE id = p_redemption_id;

  RETURN p_redemption_id;
END;
$$;

COMMENT ON FUNCTION public.fulfill_redemption(uuid, text) IS
  'Admin: pending -> fulfilled. Hold becomes final spend; no refund.';

ALTER FUNCTION public.fulfill_redemption(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.fulfill_redemption(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: deny_redemption — admin only; pending -> denied; idempotent refund.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deny_redemption(
  p_redemption_id uuid,
  p_note          text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_redemption public.redemptions;
  v_reason     text := coalesce(nullif(btrim(p_note), ''), 'Redemption denied');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not permitted to deny redemptions';
  END IF;

  SELECT * INTO v_redemption
  FROM public.redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_redemption.status = 'pending' THEN
    UPDATE public.redemptions
    SET status = 'denied',
        decided_by = v_actor,
        decided_at = now(),
        fulfillment_note = p_note
    WHERE id = p_redemption_id;

    PERFORM public._refund_redemption_hold(v_redemption, v_reason);

  ELSIF v_redemption.status IN ('denied', 'canceled') THEN
    -- Idempotent: already refunded; no second adjustment or stock bump.
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid transition: cannot deny % redemption', v_redemption.status;
  END IF;

  RETURN p_redemption_id;
END;
$$;

COMMENT ON FUNCTION public.deny_redemption(uuid, text) IS
  'Admin: pending -> denied with idempotent wallet refund + stock restore.';

ALTER FUNCTION public.deny_redemption(uuid, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.deny_redemption(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- FUNCTION: cancel_redemption — owning user or admin; pending -> canceled.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_redemption(
  p_redemption_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_redemption public.redemptions;
  v_reason     text := 'Redemption canceled';
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_redemption
  FROM public.redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_redemption.user_id <> v_actor AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not permitted to cancel this redemption';
  END IF;

  IF v_redemption.status = 'pending' THEN
    UPDATE public.redemptions
    SET status = 'canceled',
        decided_by = v_actor,
        decided_at = now()
    WHERE id = p_redemption_id;

    PERFORM public._refund_redemption_hold(v_redemption, v_reason);

  ELSE
    RAISE EXCEPTION 'Invalid transition: cannot cancel % redemption', v_redemption.status;
  END IF;

  RETURN p_redemption_id;
END;
$$;

COMMENT ON FUNCTION public.cancel_redemption(uuid) IS
  'User (own pending) or admin: pending -> canceled with idempotent refund + stock restore.';

ALTER FUNCTION public.cancel_redemption(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.cancel_redemption(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS: reward_catalog
-- -----------------------------------------------------------------------------
ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active catalog items" ON public.reward_catalog;
CREATE POLICY "Authenticated read active catalog items"
  ON public.reward_catalog FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage catalog insert" ON public.reward_catalog;
CREATE POLICY "Admins manage catalog insert"
  ON public.reward_catalog FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage catalog update" ON public.reward_catalog;
CREATE POLICY "Admins manage catalog update"
  ON public.reward_catalog FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage catalog delete" ON public.reward_catalog;
CREATE POLICY "Admins manage catalog delete"
  ON public.reward_catalog FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access reward catalog" ON public.reward_catalog;
CREATE POLICY "Service role full access reward catalog"
  ON public.reward_catalog FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.reward_catalog TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reward_catalog TO authenticated;
GRANT ALL ON public.reward_catalog TO service_role;

-- -----------------------------------------------------------------------------
-- RLS: redemptions — read only; all writes via SECURITY DEFINER RPCs.
-- -----------------------------------------------------------------------------
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own redemptions" ON public.redemptions;
CREATE POLICY "Users read own redemptions"
  ON public.redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Service role full access redemptions" ON public.redemptions;
CREATE POLICY "Service role full access redemptions"
  ON public.redemptions FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.redemptions TO authenticated;
GRANT ALL ON public.redemptions TO service_role;

-- -----------------------------------------------------------------------------
-- SEED: v1 placeholder catalog (confirm point costs + items with client)
-- Calibrated to ~100-150 pts/mo for moderately active workers.
-- -----------------------------------------------------------------------------
INSERT INTO public.reward_catalog (id, name, description, point_cost, stock_qty, category, sort_order)
VALUES
  ('a1000001-0000-4000-8000-000000000001', 'ATTS Cap', 'Branded ATTS cap', 75, NULL, 'apparel', 10),
  ('a1000001-0000-4000-8000-000000000002', 'Water Bottle', 'Insulated ATTS water bottle', 60, NULL, 'gear', 20),
  ('a1000001-0000-4000-8000-000000000003', 'ATTS Tee', 'Branded ATTS t-shirt', 100, NULL, 'apparel', 30),
  ('a1000001-0000-4000-8000-000000000004', 'Work Gloves', 'Heavy-duty work gloves', 125, NULL, 'gear', 40),
  ('a1000001-0000-4000-8000-000000000005', '$25 Gift Card', '$25 gift card', 250, NULL, 'gift_card', 50),
  ('a1000001-0000-4000-8000-000000000006', 'ATTS Hoodie', 'Branded ATTS hoodie', 400, 12, 'apparel', 60),
  ('a1000001-0000-4000-8000-000000000007', '$50 Gift Card', '$50 gift card', 500, NULL, 'gift_card', 70)
ON CONFLICT (id) DO NOTHING;
