-- =============================================================================
-- Field Safety Audit — escalation: site-scope findings + close the equipment seam
-- =============================================================================
-- CREATE OR REPLACE of escalate_field_audit_item. The idempotency / clamp /
-- ledger spine from 20260627160000 is carried forward verbatim. Scoped changes:
--
--   1. SITE SCOPE   — items with field_audit_subject_id IS NULL (audit-wide site
--                     checks: work zone, felling site, emergency prep, housekeeping)
--                     are now first-class: label resolves, the CA is created, and
--                     the notification body reads "for site conditions".
--   2. ASSIGNEE     — the equipment seam is closed. Assignee precedence is now
--                     explicit override > audited person > crew foreman
--                     (audit.foreman_id, which 20260902120000 auto-populates from
--                     the crew roster). Equipment + site findings therefore land on
--                     the foreman's CAPA list instead of an unassigned row.
--   3. SEVERITY     — 'high' only when a points deduction is actually written
--                     (person subject with a resolved user and a non-zero clamp);
--                     previously a NULL p_deduction on a non-person item could read
--                     the config default and mis-flag severity without any ledger.
--
-- NOT REGRESSED: 3-layer idempotency (early-return / claim-update / ON CONFLICT DO
-- NOTHING), [0,25] clamp, counts_toward_raffle=false, in-body
-- is_admin_or_safety_or_gf() gate, SET search_path=public, postgres owner.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.escalate_field_audit_item(
  p_item_id     uuid,
  p_deduction   integer DEFAULT NULL,
  p_action_type text    DEFAULT 'immediate',
  p_due_date    date    DEFAULT NULL,
  p_assigned_to uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id          uuid;
  v_audit_id         uuid;
  v_result           text;
  v_existing_ca      uuid;
  v_subject_type     text;
  v_person_id        uuid;
  v_label            text;
  v_ca_id            uuid;
  v_deduction        integer;
  v_deducted         boolean := false;
  v_target_user      uuid;
  v_assignee         uuid;
  v_supervisor       uuid;
  v_person_name      text;
  v_sup_body         text;
  v_severity         text;
  v_claimed          integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin_or_safety_or_gf() THEN
    RAISE EXCEPTION 'Not authorized to escalate field audit findings';
  END IF;

  -- Ad-hoc items have no checklist row -> fall back to custom_label.
  -- Site-scope items have no subject row -> v_subject_type stays NULL.
  SELECT i.id, i.field_audit_id, i.result, i.corrective_action_id,
         s.subject_type, s.person_id, COALESCE(ci.label, i.custom_label)
    INTO v_item_id, v_audit_id, v_result, v_existing_ca,
         v_subject_type, v_person_id, v_label
    FROM public.field_audit_items i
    LEFT JOIN public.field_audit_subjects s ON s.id = i.field_audit_subject_id
    LEFT JOIN public.audit_checklist_items ci ON ci.id = i.checklist_item_id
    WHERE i.id = p_item_id;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Field audit item % not found', p_item_id;
  END IF;

  IF v_result <> 'fail' THEN
    RAISE EXCEPTION 'Only FAIL items can be escalated (item % is %)', p_item_id, v_result;
  END IF;

  -- Layer (a): already escalated -> return existing CA before any write.
  IF v_existing_ca IS NOT NULL THEN
    RETURN v_existing_ca;
  END IF;

  IF p_action_type NOT IN ('immediate', 'short_term', 'long_term', 'systemic') THEN
    RAISE EXCEPTION 'Invalid action_type: %', p_action_type;
  END IF;

  -- Audited person's auth user + display name (person branch only).
  IF v_subject_type = 'person' AND v_person_id IS NOT NULL THEN
    SELECT user_id,
           COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(email), ''))
      INTO v_target_user, v_person_name
      FROM public.app_users WHERE id = v_person_id;
  END IF;

  -- Supervisor = the audit's crew foreman resolved to an auth user (NULL => role
  -- fallback for the supervisor copy). Resolved BEFORE the assignee so it can be
  -- the default owner of equipment and site findings.
  SELECT au.user_id INTO v_supervisor
    FROM public.field_audits fa
    JOIN public.app_users au ON au.id = fa.foreman_id
    WHERE fa.id = v_audit_id;

  -- Assignee precedence: explicit override > audited person > crew foreman.
  v_assignee := COALESCE(p_assigned_to, v_target_user, v_supervisor);

  INSERT INTO public.corrective_actions
    (description, action_type, assigned_by, assigned_to, due_date, status)
  VALUES (
    'Field safety audit violation: ' || COALESCE(v_label, 'finding'),
    p_action_type,
    auth.uid(),
    v_assignee,
    COALESCE(p_due_date, (now() AT TIME ZONE 'America/Chicago')::date + 7),
    'open'
  )
  RETURNING id INTO v_ca_id;

  -- Layer (b): claim the item. Lost the race -> RAISE to roll back this orphan CA.
  UPDATE public.field_audit_items
    SET corrective_action_id = v_ca_id,
        updated_at = now()
    WHERE id = p_item_id AND corrective_action_id IS NULL;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  IF v_claimed = 0 THEN
    RAISE EXCEPTION 'Field audit item % was concurrently escalated; retry', p_item_id;
  END IF;

  v_deduction := LEAST(25, GREATEST(0, COALESCE(
    p_deduction,
    (SELECT (value->>'violation_deduction')::int
       FROM public.app_settings WHERE key = 'field_audit_config'),
    0
  )));

  -- Layer (c): one deduction per item, person subject only. Dedicated partial
  -- unique index makes the ON CONFLICT a hard idempotency floor for points.
  IF v_subject_type = 'person' AND v_deduction > 0 AND v_target_user IS NOT NULL THEN
    INSERT INTO public.point_transactions
      (user_id, amount, source, reference_id, reference_table,
       counts_toward_raffle, awarded_by, reason)
    VALUES (
      v_target_user, -v_deduction, 'field_audit_violation', p_item_id,
      'field_audit_items', false, auth.uid(),
      'Field safety audit violation: ' || COALESCE(v_label, 'finding')
    )
    ON CONFLICT (source, reference_id)
      WHERE reference_id IS NOT NULL AND source = 'field_audit_violation'
      DO NOTHING;
    v_deducted := true;
  END IF;

  -- Severity tracks the ledger, not the requested amount.
  v_severity := CASE WHEN v_deducted THEN 'high' ELSE 'medium' END;
  v_sup_body := format(
    'A corrective action was issued%s: %s',
    CASE WHEN v_person_name IS NOT NULL THEN ' to ' || v_person_name
         WHEN v_subject_type = 'equipment' THEN ' for equipment'
         WHEN v_subject_type IS NULL THEN ' for site conditions'
         ELSE '' END,
    COALESCE(v_label, 'finding')
  );

  -- (1) Assignee copy — the audited person, or the foreman for equipment / site.
  IF v_assignee IS NOT NULL THEN
    INSERT INTO public.notification_events
      (category, severity, target_type, target_ref, title, body, url,
       actor_user_id, entity_type, entity_id)
    VALUES (
      'safety_alert', v_severity, 'user', v_assignee::text,
      'Safety corrective action assigned',
      'A field safety audit finding needs corrective action: '
        || COALESCE(v_label, 'finding')
        || CASE
             WHEN v_deducted
             THEN format(' (-%s safety reward point%s)', v_deduction,
                         CASE WHEN v_deduction = 1 THEN '' ELSE 's' END)
             ELSE ''
           END,
      '/dashboard', auth.uid(), 'field_audit_item', p_item_id
    );
  END IF;

  -- (2) Supervisor copy — crew foreman (user) when distinct from the assignee so
  -- no double-ping; else broadcast to general_foreman for foreman-less audits.
  IF v_supervisor IS NOT NULL AND v_supervisor IS DISTINCT FROM v_assignee THEN
    INSERT INTO public.notification_events
      (category, severity, target_type, target_ref, title, body, url,
       actor_user_id, entity_type, entity_id)
    VALUES (
      'safety_alert', v_severity, 'user', v_supervisor::text,
      'Crew corrective action issued', v_sup_body,
      '/dashboard', auth.uid(), 'field_audit_item', p_item_id
    );
  ELSIF v_supervisor IS NULL THEN
    INSERT INTO public.notification_events
      (category, severity, target_type, target_ref, title, body, url,
       actor_user_id, entity_type, entity_id)
    VALUES (
      'safety_alert', v_severity, 'role', 'general_foreman',
      'Crew corrective action issued', v_sup_body,
      '/dashboard', auth.uid(), 'field_audit_item', p_item_id
    );
  END IF;

  RETURN v_ca_id;
END;
$$;

COMMENT ON FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) IS
  'Escalate a FAIL field-audit item (person, equipment, or audit-wide site check): create '
  'a corrective action (assignee = explicit override > audited person > crew foreman), '
  'write one field_audit_violation deduction for a person subject with a non-zero clamped '
  'deduction, and emit safety_alert notification_events to the assignee and the crew '
  'foreman (or general_foreman role fallback) — high only when points were deducted. '
  'Label = COALESCE(checklist label, custom_label). Idempotent: early-return + '
  'claim-update gate the CA/notifications; the ledger rides its partial unique index.';

ALTER FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) TO authenticated, service_role;
