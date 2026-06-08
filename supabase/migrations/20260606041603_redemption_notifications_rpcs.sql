-- =============================================================================
-- Points System v2 — Redemption RPCs with best-effort notification hooks
-- =============================================================================

-- -----------------------------------------------------------------------------
-- redeem_reward — add best-effort admin notify after new pending row + hold.
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

COMMENT ON FUNCTION public.redeem_reward(uuid, uuid) IS
  'Redeem a catalog item. Idempotent on p_request_id. Deducts wallet immediately '
  '(negative redemption hold, counts_toward_raffle=false). Notifies admins on new pending.';

-- -----------------------------------------------------------------------------
-- fulfill_redemption — add best-effort recipient notify after status update.
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

  BEGIN
    PERFORM public._notify_redemption_fulfilled(p_redemption_id, v_actor);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'redemption fulfilled notify failed: %', SQLERRM;
  END;

  RETURN p_redemption_id;
END;
$$;

COMMENT ON FUNCTION public.fulfill_redemption(uuid, text) IS
  'Admin: pending -> fulfilled. Hold becomes final spend; notifies recipient.';

-- -----------------------------------------------------------------------------
-- deny_redemption — add best-effort recipient notify after deny + refund.
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

    BEGIN
      PERFORM public._notify_redemption_denied(p_redemption_id, v_actor);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'redemption denied notify failed: %', SQLERRM;
    END;

  ELSIF v_redemption.status IN ('denied', 'canceled') THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Invalid transition: cannot deny % redemption', v_redemption.status;
  END IF;

  RETURN p_redemption_id;
END;
$$;

COMMENT ON FUNCTION public.deny_redemption(uuid, text) IS
  'Admin: pending -> denied with idempotent wallet refund + stock restore; notifies recipient.';
