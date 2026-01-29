/*
  Safety Audit Log (P0 — Compliance Engine)
  Append-only, tamper-evident log for DVIR, JSA, Equipment, Incident.
  Triggers auto-insert on INSERT/UPDATE. RLS: SELECT admin/safety_officer only; no UPDATE/DELETE.
*/

-- =============================================================================
-- TABLE: safety_audit_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.safety_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload_snapshot jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.safety_audit_log IS
  'Append-only audit log for safety forms. No UPDATE/DELETE. Triggers + app (report_exported) write here.';

CREATE INDEX IF NOT EXISTS idx_safety_audit_log_occurred_at
  ON public.safety_audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_audit_log_table_record
  ON public.safety_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_safety_audit_log_event_type
  ON public.safety_audit_log(event_type);

-- =============================================================================
-- RLS: SELECT admin/safety_officer only; INSERT for trigger (DEFINER) + report_exported by admin/safety_officer
-- =============================================================================
ALTER TABLE public.safety_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_audit_log_select_admin_safety" ON public.safety_audit_log;
CREATE POLICY "safety_audit_log_select_admin_safety"
  ON public.safety_audit_log FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_supervisor());

DROP POLICY IF EXISTS "safety_audit_log_insert_report_exported" ON public.safety_audit_log;
CREATE POLICY "safety_audit_log_insert_report_exported"
  ON public.safety_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    event_type = 'report_exported'
    AND (public.is_admin() OR public.is_supervisor())
  );

-- No UPDATE/DELETE policies — table is append-only.

-- =============================================================================
-- TRIGGER FUNCTION: Insert one row into safety_audit_log (SECURITY DEFINER so it can insert)
-- =============================================================================
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
  'Trigger function: append one row to safety_audit_log on INSERT/UPDATE. SECURITY DEFINER.';

-- =============================================================================
-- TRIGGERS on dvir_reports, daily_jsa, daily_equipment_inspections, safety_incidents
-- =============================================================================
DROP TRIGGER IF EXISTS trigger_safety_audit_dvir ON public.dvir_reports;
CREATE TRIGGER trigger_safety_audit_dvir
  AFTER INSERT OR UPDATE ON public.dvir_reports
  FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();

DROP TRIGGER IF EXISTS trigger_safety_audit_jsa ON public.daily_jsa;
CREATE TRIGGER trigger_safety_audit_jsa
  AFTER INSERT OR UPDATE ON public.daily_jsa
  FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();

DROP TRIGGER IF EXISTS trigger_safety_audit_equipment ON public.daily_equipment_inspections;
CREATE TRIGGER trigger_safety_audit_equipment
  AFTER INSERT OR UPDATE ON public.daily_equipment_inspections
  FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();

DROP TRIGGER IF EXISTS trigger_safety_audit_incident ON public.safety_incidents;
CREATE TRIGGER trigger_safety_audit_incident
  AFTER INSERT OR UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();
