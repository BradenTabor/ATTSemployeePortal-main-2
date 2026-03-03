-- Add Form 301 columns to get_incident_log_osha_300_301 RPC return
-- Drop first so return type can change (CREATE OR REPLACE cannot change return type).
DROP FUNCTION IF EXISTS public.get_incident_log_osha_300_301(date, date);

CREATE OR REPLACE FUNCTION public.get_incident_log_osha_300_301(
  p_date_from date,
  p_date_to date
)
RETURNS TABLE(
  case_number text,
  incident_date date,
  incident_time time,
  employee_name text,
  employee_job_title text,
  work_site_name text,
  description text,
  what_doing_before text,
  object_substance_harmed text,
  body_parts_affected text,
  injury_illness_type text,
  severity text,
  days_away_from_work integer,
  days_restricted_duty integer,
  emergency_room_treatment boolean,
  hospitalized_overnight boolean,
  physician_name text,
  treatment_facility text,
  time_began_work time,
  employee_hire_date date,
  osha_reportable boolean,
  osha_reported boolean,
  osha_report_date date,
  job_name text,
  crew_name text,
  supervisor_name text,
  corrective_actions_taken text,
  corrective_actions_at timestamptz,
  reported_at timestamptz,
  employee_street_address text,
  employee_city text,
  employee_state text,
  employee_zip text,
  employee_date_of_birth date,
  employee_sex text,
  date_of_death date,
  privacy_case boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be >= date_from';
  END IF;
  IF p_date_to - p_date_from > 366 THEN
    RAISE EXCEPTION 'Date range must not exceed 366 days';
  END IF;

  RETURN QUERY
  SELECT
    si.case_number::text,
    si.incident_date::date,
    si.incident_time::time,
    (
      SELECT app.full_name::text
      FROM public.app_users app
      WHERE app.user_id = (si.involved_user_ids)[1]
      LIMIT 1
    ),
    si.employee_job_title::text,
    si.work_site_name::text,
    si.description::text,
    si.what_doing_before::text,
    si.object_substance_harmed::text,
    (CASE
      WHEN si.body_parts_affected IS NOT NULL AND array_length(si.body_parts_affected, 1) > 0
      THEN array_to_string(si.body_parts_affected, ', ')
      ELSE NULL
    END)::text,
    si.injury_illness_type::text,
    si.severity::text,
    si.days_away_from_work::integer,
    si.days_restricted_duty::integer,
    COALESCE(si.emergency_room_treatment, false)::boolean,
    COALESCE(si.hospitalized_overnight, false)::boolean,
    si.physician_name::text,
    si.treatment_facility::text,
    si.time_began_work::time,
    si.employee_hire_date::date,
    COALESCE(si.osha_reportable, false)::boolean,
    COALESCE(si.osha_reported, false)::boolean,
    si.osha_report_date::date,
    jpt.job_name::text,
    c.name::text,
    sup.full_name::text,
    si.corrective_actions_taken::text,
    si.corrective_actions_at::timestamptz,
    si.reported_at::timestamptz,
    si.employee_street_address::text,
    si.employee_city::text,
    si.employee_state::text,
    si.employee_zip::text,
    si.employee_date_of_birth::date,
    si.employee_sex::text,
    si.date_of_death::date,
    COALESCE(si.privacy_case, false)::boolean
  FROM public.safety_incidents si
  LEFT JOIN public.job_progress_trackers jpt ON jpt.id = si.job_id
  LEFT JOIN public.crews c ON c.id = si.crew_id
  LEFT JOIN public.app_users sup ON sup.user_id = si.supervisor_id
  WHERE si.incident_date >= p_date_from
    AND si.incident_date <= p_date_to
  ORDER BY si.incident_date DESC, si.case_number NULLS LAST, si.reported_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_incident_log_osha_300_301(date, date) IS
  'Returns incident log with OSHA 300/301 fields including Form 301 demographics and job/crew/supervisor traceability.';
