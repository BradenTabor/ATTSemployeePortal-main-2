/*
  Incident Log (OSHA 300/301) — RPC for regulator/insurer report.
  Returns safety_incidents in date range with OSHA 300/301 fields and
  traceability: job_name, crew_name, supervisor_name (joined).
*/

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
  reported_at timestamptz
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
    si.case_number,
    si.incident_date,
    si.incident_time,
    (
      SELECT app.full_name
      FROM public.app_users app
      WHERE app.user_id = (si.involved_user_ids)[1]
      LIMIT 1
    ) AS employee_name,
    si.employee_job_title,
    si.work_site_name,
    si.description,
    si.what_doing_before,
    si.object_substance_harmed,
    CASE
      WHEN si.body_parts_affected IS NOT NULL AND array_length(si.body_parts_affected, 1) > 0
      THEN array_to_string(si.body_parts_affected, ', ')
      ELSE NULL
    END AS body_parts_affected,
    si.injury_illness_type,
    si.severity,
    si.days_away_from_work,
    si.days_restricted_duty,
    COALESCE(si.emergency_room_treatment, false) AS emergency_room_treatment,
    COALESCE(si.hospitalized_overnight, false) AS hospitalized_overnight,
    si.physician_name,
    si.treatment_facility,
    si.time_began_work,
    si.employee_hire_date,
    COALESCE(si.osha_reportable, false) AS osha_reportable,
    COALESCE(si.osha_reported, false) AS osha_reported,
    si.osha_report_date,
    jpt.job_name,
    c.name AS crew_name,
    sup.full_name AS supervisor_name,
    si.corrective_actions_taken,
    si.corrective_actions_at,
    si.reported_at
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
  'Returns incident log with OSHA 300/301 fields and job/crew/supervisor traceability for report export.';
