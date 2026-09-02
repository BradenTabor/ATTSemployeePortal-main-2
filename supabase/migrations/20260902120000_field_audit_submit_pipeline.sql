-- =============================================================================
-- Field Safety Audit — Review & Submit pipeline (Gate 2 close-out)
-- =============================================================================
-- The Gate 1 `submit_field_audit(uuid)` was a bare status flip and the UI never
-- called it, so drafts could only ever be discarded. This migration turns submit
-- into a real pipeline stage and closes two seams the escalation flow depends on.
--
--   1. resolve_crew_foreman(p_crew_id) + trg_field_audits_crew_defaults
--      The UI never set field_audits.foreman_id, so every escalation's supervisor
--      copy fell through to the general_foreman ROLE fan-out. A BEFORE INSERT /
--      UPDATE OF crew_id trigger now defaults foreman_id to the crew's foreman
--      (app_users.role = 'foreman', earliest crew_members.added_at) and snapshots
--      crew_name so history survives a crew rename / delete (crew_id is SET NULL).
--
--   2. submit_field_audit(p_audit_id, p_notes) → jsonb
--      Server-side readiness gate (defense in depth behind the client Review panel):
--        FIELD_AUDIT_EMPTY              — zero checks recorded
--        FIELD_AUDIT_FAIL_NOTE_MISSING  — a Fail with no finding note
--      Machine code travels in HINT; MESSAGE stays human-readable. On success it
--      stamps status/submitted_at, folds in the audit-level notes, computes the
--      read-time rollup ONCE, emits one safety_alert to the crew foreman (user
--      target only — no role fan-out on submit), and returns the summary so the
--      client can render a receipt without a refetch. Idempotent: an already
--      submitted audit returns its summary with already_submitted = true.
--
--   3. reopen_field_audit(p_audit_id) → uuid
--      The directive's "admin-only reopen path". Flips submitted → draft and
--      clears submitted_at so the auditor's draft-only RLS lets them edit again.
--
-- NOT REGRESSED: field_audits CHECKs (submitted_requires_ts, location_present),
-- draft-only child RLS (immutability), escalate_field_audit_item (untouched),
-- no denormalized rollup column (D-decision: rollups stay read-time; the submit
-- summary is a return value, not a stored column).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Crew foreman resolution + audit defaults trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_crew_foreman(p_crew_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id
    FROM public.crew_members cm
    JOIN public.app_users au ON au.user_id = cm.user_id
   WHERE cm.crew_id = p_crew_id
     AND au.role = 'foreman'
   ORDER BY cm.added_at ASC NULLS LAST
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_crew_foreman(uuid) IS
  'app_users.id of the crew''s foreman (role = foreman, earliest member), or NULL.';

CREATE OR REPLACE FUNCTION public.field_audits_apply_crew_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.crew_id IS NOT NULL THEN
    IF NEW.foreman_id IS NULL THEN
      NEW.foreman_id := public.resolve_crew_foreman(NEW.crew_id);
    END IF;
    IF NEW.crew_name IS NULL THEN
      SELECT c.name INTO NEW.crew_name FROM public.crews c WHERE c.id = NEW.crew_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_audits_crew_defaults ON public.field_audits;
CREATE TRIGGER trg_field_audits_crew_defaults
  BEFORE INSERT OR UPDATE OF crew_id ON public.field_audits
  FOR EACH ROW EXECUTE FUNCTION public.field_audits_apply_crew_defaults();

-- Backfill existing drafts that were started with a crew but no foreman.
UPDATE public.field_audits fa
   SET foreman_id = public.resolve_crew_foreman(fa.crew_id)
 WHERE fa.crew_id IS NOT NULL AND fa.foreman_id IS NULL
   AND public.resolve_crew_foreman(fa.crew_id) IS NOT NULL;

-- Monthly / dashboard rollups read submitted audits by time.
CREATE INDEX IF NOT EXISTS idx_field_audits_submitted
  ON public.field_audits (submitted_at DESC)
  WHERE status = 'submitted';

-- -----------------------------------------------------------------------------
-- 2. submit_field_audit — readiness gate + rollup + foreman notify
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_field_audit(uuid);

CREATE OR REPLACE FUNCTION public.submit_field_audit(
  p_audit_id uuid,
  p_notes    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit          public.field_audits%ROWTYPE;
  v_already        boolean := false;
  v_total          integer;
  v_pass           integer;
  v_fail           integer;
  v_na             integer;
  v_open_fail      integer;
  v_site           integer;
  v_custom         integer;
  v_people         integer;
  v_equipment      integer;
  v_fail_no_note   integer;
  v_foreman_user   uuid;
  v_auditor_name   text;
  v_location       text;
  v_severity       text;
  v_notified       boolean := false;
  v_summary        jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_audit FROM public.field_audits WHERE id = p_audit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Field audit % not found', p_audit_id
      USING HINT = 'FIELD_AUDIT_NOT_FOUND';
  END IF;

  IF NOT (v_audit.auditor_id = auth.uid() OR public.is_admin_or_safety_or_gf()) THEN
    RAISE EXCEPTION 'Not authorized to submit this field audit'
      USING HINT = 'FIELD_AUDIT_FORBIDDEN';
  END IF;

  -- Rollup (read-time; computed once here and returned, never stored).
  SELECT
    count(*)::int,
    count(*) FILTER (WHERE result = 'pass')::int,
    count(*) FILTER (WHERE result = 'fail')::int,
    count(*) FILTER (WHERE result = 'na')::int,
    count(*) FILTER (WHERE result = 'fail' AND corrective_action_id IS NULL)::int,
    count(*) FILTER (WHERE field_audit_subject_id IS NULL)::int,
    count(*) FILTER (WHERE custom_label IS NOT NULL)::int,
    count(*) FILTER (WHERE result = 'fail' AND (note IS NULL OR length(btrim(note)) = 0))::int
  INTO v_total, v_pass, v_fail, v_na, v_open_fail, v_site, v_custom, v_fail_no_note
  FROM public.field_audit_items
  WHERE field_audit_id = p_audit_id;

  SELECT
    count(*) FILTER (WHERE subject_type = 'person')::int,
    count(*) FILTER (WHERE subject_type = 'equipment')::int
  INTO v_people, v_equipment
  FROM public.field_audit_subjects
  WHERE field_audit_id = p_audit_id;

  IF v_audit.status = 'submitted' THEN
    v_already := true;
  ELSE
    -- Readiness gate (mirrors the client's blockers; the server is the floor).
    IF v_total = 0 THEN
      RAISE EXCEPTION 'Record at least one check before submitting this audit.'
        USING HINT = 'FIELD_AUDIT_EMPTY';
    END IF;
    IF v_fail_no_note > 0 THEN
      RAISE EXCEPTION 'Every Fail needs a finding note (% missing).', v_fail_no_note
        USING HINT = 'FIELD_AUDIT_FAIL_NOTE_MISSING';
    END IF;

    UPDATE public.field_audits
       SET status       = 'submitted',
           submitted_at = now(),
           notes        = COALESCE(NULLIF(btrim(p_notes), ''), notes),
           updated_at   = now()
     WHERE id = p_audit_id AND status = 'draft'
     RETURNING * INTO v_audit;

    -- One foreman copy (user target). Skipped when the foreman IS the auditor.
    SELECT au.user_id INTO v_foreman_user
      FROM public.app_users au WHERE au.id = v_audit.foreman_id;

    IF v_foreman_user IS NOT NULL AND v_foreman_user IS DISTINCT FROM auth.uid() THEN
      SELECT COALESCE(NULLIF(btrim(full_name), ''), NULLIF(btrim(email), ''), 'A safety officer')
        INTO v_auditor_name
        FROM public.app_users WHERE user_id = auth.uid();

      v_location := COALESCE(
        (SELECT ws.name FROM public.work_sites ws WHERE ws.id = v_audit.work_site_id),
        v_audit.location_text,
        'your site');

      v_severity := CASE
        WHEN v_open_fail > 0 THEN 'high'
        WHEN v_fail > 0      THEN 'medium'
        ELSE 'low' END;

      INSERT INTO public.notification_events
        (category, severity, target_type, target_ref, title, body, url,
         actor_user_id, entity_type, entity_id)
      VALUES (
        'safety_alert', v_severity, 'user', v_foreman_user::text,
        'Field safety audit completed',
        format('%s audited %s: %s check%s, %s finding%s%s.',
          v_auditor_name, v_location,
          v_total, CASE WHEN v_total = 1 THEN '' ELSE 's' END,
          v_fail,  CASE WHEN v_fail  = 1 THEN '' ELSE 's' END,
          CASE WHEN v_open_fail > 0
               THEN format(' (%s awaiting corrective action)', v_open_fail)
               ELSE '' END),
        '/dashboard', auth.uid(), 'field_audit', p_audit_id
      );
      v_notified := true;
    END IF;
  END IF;

  v_summary := jsonb_build_object(
    'audit_id',          v_audit.id,
    'status',            v_audit.status,
    'submitted_at',      v_audit.submitted_at,
    'already_submitted', v_already,
    'notified_foreman',  v_notified,
    'subjects', jsonb_build_object('people', v_people, 'equipment', v_equipment),
    'checks',   jsonb_build_object(
                  'total', v_total, 'pass', v_pass, 'fail', v_fail, 'na', v_na,
                  'open_fail', v_open_fail, 'site', v_site, 'custom', v_custom)
  );
  RETURN v_summary;
END;
$$;

COMMENT ON FUNCTION public.submit_field_audit(uuid, text) IS
  'Submit a field audit (draft → submitted). Server readiness gate (HINT codes '
  'FIELD_AUDIT_EMPTY / FIELD_AUDIT_FAIL_NOTE_MISSING), folds in audit notes, emits one '
  'safety_alert to the crew foreman (user target, never role fan-out), and returns the '
  'read-time rollup as jsonb. Idempotent for already-submitted audits.';

-- -----------------------------------------------------------------------------
-- 3. reopen_field_audit — admin-only reopen path
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reopen_field_audit(p_audit_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can reopen a submitted field audit'
      USING HINT = 'FIELD_AUDIT_FORBIDDEN';
  END IF;

  SELECT status INTO v_status FROM public.field_audits WHERE id = p_audit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Field audit % not found', p_audit_id
      USING HINT = 'FIELD_AUDIT_NOT_FOUND';
  END IF;

  IF v_status = 'submitted' THEN
    UPDATE public.field_audits
       SET status = 'draft', submitted_at = NULL, updated_at = now()
     WHERE id = p_audit_id;
  END IF;

  RETURN p_audit_id;
END;
$$;

COMMENT ON FUNCTION public.reopen_field_audit(uuid) IS
  'Admin-only: reopen a submitted field audit (submitted → draft, clears submitted_at) '
  'so the auditor''s draft-only RLS lets them amend it. Idempotent for drafts.';

-- Pin the RLS-bypass invariant (notification_events INSERT is admin/service-only).
ALTER FUNCTION public.submit_field_audit(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.reopen_field_audit(uuid) OWNER TO postgres;
ALTER FUNCTION public.field_audits_apply_crew_defaults() OWNER TO postgres;
ALTER FUNCTION public.resolve_crew_foreman(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.submit_field_audit(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_field_audit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_crew_foreman(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_field_audit(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_field_audit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_crew_foreman(uuid) TO authenticated, service_role;
