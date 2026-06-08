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
