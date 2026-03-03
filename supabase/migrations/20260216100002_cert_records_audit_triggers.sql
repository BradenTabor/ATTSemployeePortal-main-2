-- Add audit triggers for certification_records (issuance, revocation, status changes).
-- Follows the same pattern as dvir_reports: INSERT/UPDATE write to safety_audit_log.

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
  ELSIF TG_TABLE_NAME = 'certification_records' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'cert_created' ELSE 'cert_updated' END;
  ELSE
    v_event_type := TG_TABLE_NAME || '_' || LOWER(TG_OP);
  END IF;
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;

  -- Resolve actor per table
  IF TG_TABLE_NAME = 'safety_incidents' THEN
    v_user_id := COALESCE((NEW).reported_by, (NEW).user_id, auth.uid());
  ELSIF TG_TABLE_NAME = 'certification_records' THEN
    v_user_id := COALESCE((NEW).certified_by, (NEW).revoked_by, auth.uid());
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
  ELSIF TG_TABLE_NAME = 'certification_records' THEN
    v_payload := v_payload || jsonb_build_object(
      'user_id', (NEW).user_id,
      'certification_type', (NEW).certification_type_id,
      'status', (NEW).status,
      'changed_at', (NEW).updated_at
    );
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
  'Trigger function: append one row to safety_audit_log on INSERT/UPDATE. SECURITY DEFINER. Includes certification_records.';

DROP TRIGGER IF EXISTS trigger_safety_audit_cert_records ON public.certification_records;
CREATE TRIGGER trigger_safety_audit_cert_records
  AFTER INSERT OR UPDATE ON public.certification_records
  FOR EACH ROW
  EXECUTE FUNCTION public.safety_audit_log_insert();
