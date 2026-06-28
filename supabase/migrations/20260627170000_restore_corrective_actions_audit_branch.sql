-- =============================================================================
-- Restore the corrective_actions branch in safety_audit_log_insert()
-- =============================================================================
-- REGRESSION FIX (pre-existing, prod-wide). 20260216500000_corrective_actions.sql
-- authored safety_audit_log_insert() WITH a corrective_actions branch (actor =
-- assigned_by) and attached the AFTER INSERT OR UPDATE trigger. Two later
-- migrations — 20260301000001_create_safety_audit_log.sql and
-- 20260303000000_fix_safety_audit_log_dvir_reported_by.sql — each CREATE OR
-- REPLACE'd the function from an older copy that DROPPED that branch. The trigger
-- stayed attached, so its generic ELSE now dereferences (NEW).user_id, a column
-- corrective_actions does not have:
--
--     ERROR: column "user_id" not found in data type corrective_actions
--
-- Net effect: EVERY corrective_actions INSERT/UPDATE has failed since ~2026-03-01
-- (corrective_actions is empty on prod). That kills both the near-miss -> CAPA
-- flow and the new field-audit escalation (escalate_field_audit_item).
--
-- This is a MINIMAL RESTORE: the body below is the current prod function verbatim
-- (incl. the safety_flags branch and the safety_incidents reported_by actor fix)
-- with ONLY the three corrective_actions branches re-added — event_type, actor
-- (assigned_by), and payload — exactly as 20260216500000 authored them. Behavior
-- for the other six attached tables is byte-identical. All referenced
-- corrective_actions columns (id, incident_id, action_type, status, due_date,
-- created_at, assigned_by) are confirmed present on the live table.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.safety_audit_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_user_id uuid;
  v_payload jsonb;
BEGIN
  IF TG_TABLE_NAME = 'dvir_reports' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'dvir_submitted' ELSE 'dvir_updated' END;
  ELSIF TG_TABLE_NAME = 'daily_jsa' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'jsa_submitted' ELSE 'jsa_updated' END;
  ELSIF TG_TABLE_NAME = 'daily_equipment_inspections' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'equipment_submitted' ELSE 'equipment_updated' END;
  ELSIF TG_TABLE_NAME = 'safety_incidents' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'incident_created' ELSE 'incident_updated' END;
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'safety_flag_created' ELSE 'safety_flag_updated' END;
  ELSIF TG_TABLE_NAME = 'corrective_actions' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'corrective_action_created' ELSE 'corrective_action_updated' END;
  ELSE
    v_event_type := TG_TABLE_NAME || '_' || LOWER(TG_OP);
  END IF;
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'safety_incidents' THEN
    v_user_id := COALESCE((NEW).reported_by, (NEW).user_id, auth.uid());
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_user_id := COALESCE((NEW).flagged_by, auth.uid());
  ELSIF TG_TABLE_NAME = 'corrective_actions' THEN
    v_user_id := COALESCE((NEW).assigned_by, auth.uid());
  ELSE
    v_user_id := COALESCE((NEW).user_id, auth.uid());
  END IF;

  v_payload := jsonb_build_object('id', (NEW).id, 'op', TG_OP);
  IF TG_TABLE_NAME = 'dvir_reports' THEN
    v_payload := v_payload || jsonb_build_object('report_date', (NEW).report_date, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'daily_jsa' THEN
    v_payload := v_payload || jsonb_build_object('job_date', (NEW).job_date, 'status', (NEW).status, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'daily_equipment_inspections' THEN
    v_payload := v_payload || jsonb_build_object('inspection_date', (NEW).inspection_date, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'safety_incidents' THEN
    v_payload := v_payload || jsonb_build_object('incident_date', (NEW).incident_date, 'case_number', (NEW).case_number, 'reported_at', (NEW).reported_at);
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_payload := v_payload || jsonb_build_object('form_type', (NEW).form_type, 'form_id', (NEW).form_id, 'status', (NEW).status, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'corrective_actions' THEN
    v_payload := v_payload || jsonb_build_object('incident_id', (NEW).incident_id, 'action_type', (NEW).action_type, 'status', (NEW).status, 'due_date', (NEW).due_date, 'created_at', (NEW).created_at);
  END IF;

  INSERT INTO public.safety_audit_log (event_type, table_name, record_id, user_id, occurred_at, payload_snapshot)
  VALUES (v_event_type, TG_TABLE_NAME, (NEW).id, v_user_id, now(), v_payload);
  RETURN NEW;
END;
$$;
