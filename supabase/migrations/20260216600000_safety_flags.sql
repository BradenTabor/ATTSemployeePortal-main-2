/*
  safety_flags — Flag forms for SO/GF review.
  RLS: Admin, Safety Officer, General Foreman can manage; any authenticated can create.
  Audit: INSERT/UPDATE written to safety_audit_log via extended trigger.
*/

-- Table
CREATE TABLE IF NOT EXISTS public.safety_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_type text NOT NULL CHECK (form_type IN ('jsa', 'dvir', 'equipment', 'incident', 'near_miss')),
  form_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.safety_flags IS 'Flags for safety officer / general foreman review of specific form submissions.';

ALTER TABLE public.safety_flags ENABLE ROW LEVEL SECURITY;

-- Helper: true if current user is admin, safety_officer, or general_foreman
CREATE OR REPLACE FUNCTION public.is_admin_or_safety_or_gf()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role IN ('admin', 'safety_officer', 'general_foreman')
    FROM public.app_users
    WHERE user_id = auth.uid()
  ), false);
$$;

-- SO, Admin, GF can do everything on safety_flags
CREATE POLICY safety_flags_management ON public.safety_flags
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_safety_or_gf())
  WITH CHECK (public.is_admin_or_safety_or_gf());

-- Any authenticated user can create a flag (for "Flag for Review" from forms)
CREATE POLICY safety_flags_create ON public.safety_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND flagged_by = auth.uid());

-- Extend safety_audit_log trigger to include safety_flags (actor = flagged_by)
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
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'safety_flag_created' ELSE 'safety_flag_updated' END;
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
  END IF;

  INSERT INTO public.safety_audit_log (event_type, table_name, record_id, user_id, occurred_at, payload_snapshot)
  VALUES (v_event_type, TG_TABLE_NAME, (NEW).id, v_user_id, now(), v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_safety_audit_safety_flags ON public.safety_flags;
CREATE TRIGGER trigger_safety_audit_safety_flags
  AFTER INSERT OR UPDATE ON public.safety_flags
  FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();

CREATE INDEX IF NOT EXISTS idx_safety_flags_status ON public.safety_flags(status);
CREATE INDEX IF NOT EXISTS idx_safety_flags_form ON public.safety_flags(form_type, form_id);
CREATE INDEX IF NOT EXISTS idx_safety_flags_created_at ON public.safety_flags(created_at DESC);
