/*
  Fix: safety_audit_log_insert referenced (NEW).reported_by for all tables.
  dvir_reports (and daily_jsa, daily_equipment_inspections) have user_id only;
  safety_incidents has reported_by. Resolve actor per table to avoid "column reported_by not found in data type dvir_reports".
*/

CREATE OR REPLACE FUNCTION public.safety_audit_log_insert()
RETURNS TRIGGER
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
  ELSE
    v_event_type := TG_TABLE_NAME || '_' || LOWER(TG_OP);
  END IF;
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;

  -- Resolve actor: dvir_reports/daily_jsa/daily_equipment_inspections use user_id; safety_incidents use reported_by
  IF TG_TABLE_NAME = 'safety_incidents' THEN
    v_user_id := COALESCE((NEW).reported_by, (NEW).user_id, auth.uid());
  ELSE
    v_user_id := COALESCE((NEW).user_id, auth.uid());
  END IF;

  v_payload := jsonb_build_object(
    'id', (NEW).id,
    'op', TG_OP
  );
  IF TG_TABLE_NAME = 'dvir_reports' THEN
    v_payload := v_payload || jsonb_build_object('report_date', (NEW).report_date, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'daily_jsa' THEN
    v_payload := v_payload || jsonb_build_object('job_date', (NEW).job_date, 'status', (NEW).status, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'daily_equipment_inspections' THEN
    v_payload := v_payload || jsonb_build_object('inspection_date', (NEW).inspection_date, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'safety_incidents' THEN
    v_payload := v_payload || jsonb_build_object('incident_date', (NEW).incident_date, 'case_number', (NEW).case_number, 'reported_at', (NEW).reported_at);
  END IF;

  INSERT INTO public.safety_audit_log (
    event_type,
    table_name,
    record_id,
    user_id,
    occurred_at,
    payload_snapshot
  ) VALUES (
    v_event_type,
    TG_TABLE_NAME,
    (NEW).id,
    v_user_id,
    now(),
    v_payload
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.safety_audit_log_insert() IS
  'Trigger function: append one row to safety_audit_log on INSERT/UPDATE. SECURITY DEFINER. Resolves actor per table (user_id vs reported_by).';
