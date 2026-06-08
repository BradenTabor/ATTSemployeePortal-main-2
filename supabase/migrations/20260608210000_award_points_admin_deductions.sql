-- Allow admins to deduct points via negative manual_award amounts.
-- Grant holders remain positive-only and bounded by cap/budget.

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
  v_categories  text[] := ARRAY[
    'maintenance', 'good_performance', 'safety_catch',
    'attendance', 'peer_recognition', 'other'
  ];
BEGIN
  IF NOT public.can_award_points(v_actor) THEN
    RAISE EXCEPTION 'Not permitted to award points';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users au WHERE au.user_id = p_recipient) THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;

  IF p_recipient = v_actor THEN
    RAISE EXCEPTION 'Cannot award points to yourself';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Amount must be non-zero';
  END IF;

  IF p_amount < 0 AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins may deduct points';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  IF p_category IS NULL OR NOT (p_category = ANY (v_categories)) THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  SELECT pt.id INTO v_tx_id
  FROM public.point_transactions pt
  WHERE pt.source = 'manual_award'
    AND pt.request_id = p_request_id;
  IF v_tx_id IS NOT NULL THEN
    RETURN v_tx_id;
  END IF;

  IF NOT public.is_admin() AND p_amount > 0 THEN
    SELECT * INTO v_grant
    FROM public.point_awarder_grants g
    WHERE g.user_id = v_actor
      AND g.revoked_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not permitted to award points';
    END IF;

    IF p_amount > v_grant.per_award_cap THEN
      RAISE EXCEPTION 'Exceeds per-award cap of %', v_grant.per_award_cap;
    END IF;

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

  INSERT INTO public.point_transactions
    (user_id, amount, source, counts_toward_raffle, category, reason, awarded_by, request_id)
  VALUES
    (p_recipient, p_amount, 'manual_award', true, p_category, v_reason, v_actor, p_request_id)
  ON CONFLICT (request_id) WHERE source = 'manual_award' AND request_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_tx_id;

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
  'Admins may pass negative amounts to deduct points. Writes a manual_award ledger row '
  '(counts_toward_raffle = true) and returns its tx id.';

-- Notification copy for negative manual awards.
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
  v_abs_amount   integer;
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

  SELECT * INTO v_tx
  FROM public.point_transactions pt
  WHERE pt.source = 'manual_award'
    AND pt.request_id = p_request_id
    AND pt.awarded_by = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manual award not found or not awarded by you';
  END IF;

  SELECT ne.id INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'manual_award'
    AND ne.entity_id = v_tx.id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

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

  v_abs_amount := abs(v_tx.amount);

  IF v_tx.amount < 0 THEN
    v_title := format(
      '%s safety reward point%s deducted',
      v_abs_amount,
      CASE WHEN v_abs_amount = 1 THEN '' ELSE 's' END
    );
    v_body := concat_ws(
      ' ',
      CASE
        WHEN v_awarder_name IS NOT NULL THEN
          format('%s deducted %s point%s.', v_awarder_name, v_abs_amount, CASE WHEN v_abs_amount = 1 THEN '' ELSE 's' END)
        ELSE
          format('%s point%s were deducted.', v_abs_amount, CASE WHEN v_abs_amount = 1 THEN '' ELSE 's' END)
      END,
      format('Category: %s.', v_category_lbl),
      CASE
        WHEN NULLIF(btrim(v_tx.reason), '') IS NOT NULL THEN
          format('Reason: %s', btrim(v_tx.reason))
        ELSE NULL
      END
    );
  ELSE
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
  END IF;

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
