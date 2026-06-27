-- =============================================================================
-- Field Safety Audit — Migration 3/4: ledger plumbing + RPCs
-- =============================================================================
-- Depends on migration 1 (point_source 'field_audit_violation' committed) and
-- migration 2 (field_audit_* tables, audit_checklist_items, app_settings key).
--
--   * field_audit_violation_is_negative CHECK on point_transactions
--   * uq_point_tx_field_audit_violation — DEDICATED partial unique index for
--     ledger idempotency. uq_point_tx_source_ref is deliberately left untouched
--     (its predicate is coupled to existing award functions' ON CONFLICT clauses).
--   * submit_field_audit(p_audit_id)
--   * escalate_field_audit_item(...) — 3-layer idempotency
-- =============================================================================

-- A field_audit_violation ledger row must always be a deduction.
DO $$ BEGIN
  ALTER TABLE public.point_transactions
    ADD CONSTRAINT field_audit_violation_is_negative
    CHECK (source <> 'field_audit_violation' OR amount < 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dedicated idempotency index for audit-violation deductions.
-- The escalate RPC infers THIS index via a matching ON CONFLICT predicate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_point_tx_field_audit_violation
  ON public.point_transactions (source, reference_id)
  WHERE reference_id IS NOT NULL AND source = 'field_audit_violation';

-- -----------------------------------------------------------------------------
-- submit_field_audit — flip draft → submitted, stamp submitted_at.
-- Authz: the auditor who owns the draft, or a supervisor. Idempotent: a no-op
-- (returns the id) if the audit is already submitted.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_field_audit(p_audit_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit public.field_audits%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_audit FROM public.field_audits WHERE id = p_audit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Field audit % not found', p_audit_id;
  END IF;

  IF NOT (v_audit.auditor_id = auth.uid() OR public.is_admin_or_safety_or_gf()) THEN
    RAISE EXCEPTION 'Not authorized to submit this field audit';
  END IF;

  IF v_audit.status = 'submitted' THEN
    RETURN v_audit.id;
  END IF;

  UPDATE public.field_audits
    SET status = 'submitted',
        submitted_at = now(),
        updated_at = now()
    WHERE id = p_audit_id AND status = 'draft';

  RETURN p_audit_id;
END;
$$;

COMMENT ON FUNCTION public.submit_field_audit(uuid) IS
  'Submit a field audit (draft to submitted). Gate 1 scope: status flip + submitted_at. result_summary rollups are not part of the Gate 1 schema.';

-- -----------------------------------------------------------------------------
-- escalate_field_audit_item — create a corrective action for a FAIL item and,
-- for a person subject with a non-zero deduction, write ONE deduction ledger row.
--
-- Idempotency (3 layers):
--   (a) early-return the existing corrective_action_id if already escalated;
--   (b) insert the corrective action, then claim it with
--       UPDATE ... SET corrective_action_id WHERE corrective_action_id IS NULL;
--       if NOT FOUND (lost a race), RAISE to roll back the orphan CA;
--   (c) ledger insert with ON CONFLICT DO NOTHING (dedicated partial index).
--
-- Deduction: target = app_users.user_id of the person subject. Amount is
-- server-read from app_settings.field_audit_config -> 'violation_deduction'
-- (override via p_deduction), clamped to [0, 25]. The ledger row is SKIPPED
-- entirely when the subject is equipment/site or the deduction resolves to 0.
-- -----------------------------------------------------------------------------
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
  v_target_user      uuid;
  v_claimed          integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin_or_safety_or_gf() THEN
    RAISE EXCEPTION 'Not authorized to escalate field audit findings';
  END IF;

  SELECT i.id, i.field_audit_id, i.result, i.corrective_action_id,
         s.subject_type, s.person_id, ci.label
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

  IF v_existing_ca IS NOT NULL THEN
    RETURN v_existing_ca;
  END IF;

  IF p_action_type NOT IN ('immediate', 'short_term', 'long_term', 'systemic') THEN
    RAISE EXCEPTION 'Invalid action_type: %', p_action_type;
  END IF;

  INSERT INTO public.corrective_actions
    (description, action_type, assigned_by, assigned_to, due_date, status)
  VALUES (
    'Field safety audit violation: ' || COALESCE(v_label, 'finding'),
    p_action_type,
    auth.uid(),
    p_assigned_to,
    COALESCE(p_due_date, (now() AT TIME ZONE 'America/Chicago')::date + 7),
    'open'
  )
  RETURNING id INTO v_ca_id;

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

  IF v_subject_type = 'person' AND v_deduction > 0 THEN
    SELECT user_id INTO v_target_user FROM public.app_users WHERE id = v_person_id;

    IF v_target_user IS NOT NULL THEN
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
    END IF;
  END IF;

  RETURN v_ca_id;
END;
$$;

COMMENT ON FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) IS
  'Escalate a FAIL field-audit item: create a corrective action and, for a person '
  'subject with a non-zero clamped deduction, write one field_audit_violation ledger '
  'row. Idempotent (3 layers: early-return, claim-update, ON CONFLICT DO NOTHING).';

REVOKE ALL ON FUNCTION public.submit_field_audit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_field_audit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.escalate_field_audit_item(uuid, integer, text, date, uuid) TO authenticated, service_role;
