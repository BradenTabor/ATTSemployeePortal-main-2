-- =============================================================================
-- Points System v2 — Increment 2b: notify_manual_award_recipient RPC
-- Dedicated notification path for manual awards. award_points stays ledger-pure;
-- this RPC inserts notification_events only. Delivery relies on the existing
-- notification_events_dispatch_on_insert trigger (pg_net → notifications-dispatch).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.notify_manual_award_recipient(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_tx           public.point_transactions;
  v_event_id     uuid;
  v_awarder_name text;
  v_category_lbl text;
  v_title        text;
  v_body         text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_award_points(v_actor) THEN
    RAISE EXCEPTION 'Not permitted to notify for manual award';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  -- Caller may only notify for a manual_award they personally awarded.
  SELECT * INTO v_tx
  FROM public.point_transactions pt
  WHERE pt.source = 'manual_award'
    AND pt.request_id = p_request_id
    AND pt.awarded_by = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manual award not found or not awarded by you';
  END IF;

  -- Idempotent: one notification per ledger row (entity_id = tx.id).
  SELECT ne.id INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'manual_award'
    AND ne.entity_id = v_tx.id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  -- Prefer full_name, fall back to email for the awarder attribution line.
  SELECT COALESCE(
    NULLIF(btrim(au.full_name), ''),
    NULLIF(btrim(au.email), '')
  ) INTO v_awarder_name
  FROM public.app_users au
  WHERE au.user_id = v_actor;

  v_category_lbl := CASE v_tx.category
    WHEN 'maintenance'       THEN 'Maintenance'
    WHEN 'good_performance'  THEN 'Good Performance'
    WHEN 'safety_catch'      THEN 'Safety Catch'
    WHEN 'attendance'        THEN 'Attendance'
    WHEN 'peer_recognition'  THEN 'Peer Recognition'
    WHEN 'other'             THEN 'Other'
    ELSE COALESCE(v_tx.category, 'Other')
  END;

  v_title := format(
    'You received %s safety reward point%s!',
    v_tx.amount,
    CASE WHEN v_tx.amount = 1 THEN '' ELSE 's' END
  );

  v_body := concat_ws(
    ' ',
    CASE
      WHEN v_awarder_name IS NOT NULL THEN
        format('%s awarded you %s points.', v_awarder_name, v_tx.amount)
      ELSE
        format('You were awarded %s points.', v_tx.amount)
    END,
    format('Category: %s.', v_category_lbl),
    CASE
      WHEN NULLIF(btrim(v_tx.reason), '') IS NOT NULL THEN
        format('Reason: %s', btrim(v_tx.reason))
      ELSE NULL
    END
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
    v_tx.user_id::text,
    v_title,
    v_body,
    '/safety-rewards',
    v_actor,
    'manual_award',
    v_tx.id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.notify_manual_award_recipient(uuid) IS
  'Creates a server-built notification_event for a manual_award the caller awarded. '
  'Idempotent on entity_id (point_transactions.id). Delivery is handled by '
  'notification_events_dispatch_on_insert (pg_net → notifications-dispatch).';

ALTER FUNCTION public.notify_manual_award_recipient(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.notify_manual_award_recipient(uuid) TO authenticated;
