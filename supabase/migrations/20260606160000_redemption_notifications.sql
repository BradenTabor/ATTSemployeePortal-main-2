-- =============================================================================
-- Points System v2 — Redemption notifications (DB-side, best-effort)
-- Inserts notification_events from within redemption RPCs (SECURITY DEFINER).
-- Delivery uses notification_events_dispatch_on_insert → notifications-dispatch.
-- Category admin_notice reused (no preferences migration).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal: notify admins when a new pending redemption is created.
-- target_type=role / target_ref=admin — one event fans out to all admins.
-- Idempotent on entity_type=redemption_pending + entity_id=redemption.id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify_redemption_pending_admins(p_redemption_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.redemptions;
  v_item_name  text;
  v_requester  text;
  v_title      text;
  v_event_id   uuid;
  v_actor      uuid := auth.uid();
BEGIN
  IF p_redemption_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ne.id INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'redemption_pending'
    AND ne.entity_id = p_redemption_id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  SELECT r.* INTO v_redemption
  FROM public.redemptions r
  WHERE r.id = p_redemption_id;

  IF NOT FOUND OR v_redemption.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  SELECT rc.name INTO v_item_name
  FROM public.reward_catalog rc
  WHERE rc.id = v_redemption.item_id;

  SELECT COALESCE(
    NULLIF(btrim(au.full_name), ''),
    NULLIF(btrim(au.email), '')
  ) INTO v_requester
  FROM public.app_users au
  WHERE au.user_id = v_redemption.user_id;

  v_title := format(
    '%s redeemed %s (%s pts) — pending fulfillment.',
    COALESCE(v_requester, 'An employee'),
    COALESCE(v_item_name, 'an item'),
    v_redemption.point_cost
  );

  INSERT INTO public.notification_events (
    category,
    severity,
    target_type,
    target_ref,
    title,
    body,
    url,
    actor_user_id,
    entity_type,
    entity_id
  ) VALUES (
    'admin_notice',
    'medium',
    'role',
    'admin',
    v_title,
    v_title,
    '/admin/redemption-fulfillment',
    v_actor,
    'redemption_pending',
    p_redemption_id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

ALTER FUNCTION public._notify_redemption_pending_admins(uuid) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- Internal: notify recipient when admin fulfills a pending redemption.
-- Idempotent on entity_type=redemption_fulfilled + entity_id=redemption.id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify_redemption_fulfilled(
  p_redemption_id uuid,
  p_actor         uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.redemptions;
  v_item_name  text;
  v_title      text;
  v_body       text;
  v_event_id   uuid;
BEGIN
  IF p_redemption_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ne.id INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'redemption_fulfilled'
    AND ne.entity_id = p_redemption_id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  SELECT r.* INTO v_redemption
  FROM public.redemptions r
  WHERE r.id = p_redemption_id;

  IF NOT FOUND OR v_redemption.status <> 'fulfilled' THEN
    RETURN NULL;
  END IF;

  SELECT rc.name INTO v_item_name
  FROM public.reward_catalog rc
  WHERE rc.id = v_redemption.item_id;

  v_title := format('Your %s is ready', COALESCE(v_item_name, 'reward'));
  v_body := format(
    'Your %s redemption has been fulfilled and is ready to be handed over.',
    COALESCE(v_item_name, 'item')
  );

  INSERT INTO public.notification_events (
    category,
    severity,
    target_type,
    target_ref,
    title,
    body,
    url,
    actor_user_id,
    entity_type,
    entity_id
  ) VALUES (
    'admin_notice',
    'medium',
    'user',
    v_redemption.user_id::text,
    v_title,
    v_body,
    '/my-points',
    p_actor,
    'redemption_fulfilled',
    p_redemption_id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

ALTER FUNCTION public._notify_redemption_fulfilled(uuid, uuid) OWNER TO postgres;

-- -----------------------------------------------------------------------------
-- Internal: notify recipient when admin denies a pending redemption (refund).
-- Idempotent on entity_type=redemption_denied + entity_id=redemption.id.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify_redemption_denied(
  p_redemption_id uuid,
  p_actor         uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.redemptions;
  v_item_name  text;
  v_title      text;
  v_body       text;
  v_event_id   uuid;
BEGIN
  IF p_redemption_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ne.id INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'redemption_denied'
    AND ne.entity_id = p_redemption_id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  SELECT r.* INTO v_redemption
  FROM public.redemptions r
  WHERE r.id = p_redemption_id;

  IF NOT FOUND OR v_redemption.status <> 'denied' THEN
    RETURN NULL;
  END IF;

  SELECT rc.name INTO v_item_name
  FROM public.reward_catalog rc
  WHERE rc.id = v_redemption.item_id;

  v_title := format('Your %s redemption was denied', COALESCE(v_item_name, 'reward'));
  v_body := format(
    'Your %s redemption was denied — your %s points have been refunded.',
    COALESCE(v_item_name, 'item'),
    v_redemption.point_cost
  );

  INSERT INTO public.notification_events (
    category,
    severity,
    target_type,
    target_ref,
    title,
    body,
    url,
    actor_user_id,
    entity_type,
    entity_id
  ) VALUES (
    'admin_notice',
    'medium',
    'user',
    v_redemption.user_id::text,
    v_title,
    v_body,
    '/my-points',
    p_actor,
    'redemption_denied',
    p_redemption_id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

ALTER FUNCTION public._notify_redemption_denied(uuid, uuid) OWNER TO postgres;

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
