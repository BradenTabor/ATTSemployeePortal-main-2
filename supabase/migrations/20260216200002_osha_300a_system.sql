-- OSHA 300A Annual Summary system
-- RPC for aggregate totals + certification table with RLS and audit triggers
-- (is_admin_or_safety_or_gf also used by safety_flags/compliance; create here so RLS can use it.)
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

-- =============================================================================
-- RPC: get_osha_300a_summary
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_osha_300a_summary(
  p_year INTEGER,
  p_total_employees_avg NUMERIC DEFAULT NULL,
  p_total_hours_worked NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'year', p_year,
    'total_recordable_cases', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true),
    'cases_days_away', COUNT(*) FILTER (WHERE severity IN ('lost_time', 'fatality') AND COALESCE(days_away_from_work, 0) > 0),
    'cases_job_transfer', COUNT(*) FILTER (WHERE COALESCE(days_restricted_duty, 0) > 0),
    'other_recordable', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true AND severity = 'recordable'),
    'total_days_away', COALESCE(SUM(days_away_from_work) FILTER (WHERE COALESCE(osha_reportable, false) = true), 0),
    'total_days_restricted', COALESCE(SUM(days_restricted_duty) FILTER (WHERE COALESCE(osha_reportable, false) = true), 0),
    'total_injuries', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true AND injury_illness_type = 'injury'),
    'total_illnesses', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true AND injury_illness_type IS NOT NULL AND injury_illness_type != 'injury'),
    'death_count', COUNT(*) FILTER (WHERE severity = 'fatality'),
    'total_employees_avg', p_total_employees_avg,
    'total_hours_worked', p_total_hours_worked
  ) INTO result
  FROM public.safety_incidents
  WHERE EXTRACT(YEAR FROM incident_date) = p_year;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_osha_300a_summary(INTEGER, NUMERIC, NUMERIC) IS
  'Returns OSHA 300A annual summary aggregate counts for a given year.';

-- =============================================================================
-- TABLE: osha_300a_certifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.osha_300a_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  certified_by_name TEXT NOT NULL,
  certified_by_title TEXT NOT NULL,
  certified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature TEXT NOT NULL,
  total_employees_avg NUMERIC,
  total_hours_worked NUMERIC,
  summary_data JSONB NOT NULL,
  posted_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.osha_300a_certifications IS 'OSHA 300A annual summary certifications. Post Feb 1–Apr 30 per 29 CFR 1904.32.';

ALTER TABLE public.osha_300a_certifications ENABLE ROW LEVEL SECURITY;

-- RLS: admin and safety_officer only (use is_admin_or_safety_or_gf which includes both)
CREATE POLICY osha_300a_select ON public.osha_300a_certifications
  FOR SELECT USING (public.is_admin_or_safety_or_gf());

CREATE POLICY osha_300a_insert ON public.osha_300a_certifications
  FOR INSERT WITH CHECK (public.is_admin_or_safety_or_gf());

CREATE POLICY osha_300a_update ON public.osha_300a_certifications
  FOR UPDATE USING (public.is_admin_or_safety_or_gf());

-- No DELETE policy — certifications are permanent records

-- =============================================================================
-- AUDIT TRIGGER (dedicated for osha_300a_certifications to avoid conflict with later migrations)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.safety_audit_log_osha_300a()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'osha_300a_certified' ELSE 'osha_300a_updated' END;
  v_payload := jsonb_build_object(
    'id', (NEW).id,
    'op', TG_OP,
    'year', (NEW).year,
    'certified_at', (NEW).certified_at,
    'posted_date', (NEW).posted_date
  );
  INSERT INTO public.safety_audit_log (event_type, table_name, record_id, user_id, occurred_at, payload_snapshot)
  VALUES (v_event_type, 'osha_300a_certifications', (NEW).id, auth.uid(), now(), v_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_safety_audit_osha_300a ON public.osha_300a_certifications;
CREATE TRIGGER trigger_safety_audit_osha_300a
  AFTER INSERT OR UPDATE ON public.osha_300a_certifications
  FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_osha_300a();
