-- =============================================================================
-- Migration: Add OSHA 300/301 Compliance Fields to safety_incidents
-- =============================================================================
-- This migration adds fields required for OSHA Form 300 (Log of Work-Related
-- Injuries and Illnesses) and Form 301 (Injury and Illness Incident Report).
--
-- OSHA 300 Required Fields:
--   - case_number (unique identifier)
--   - employee_job_title
--   - body_parts_affected
--   - days_away_from_work
--   - days_restricted_duty
--   - injury_illness_type (injury, skin_disorder, respiratory, etc.)
--
-- OSHA 301 Required Fields:
--   - incident_time
--   - what_doing_before (activity before incident)
--   - object_substance_harmed (what caused the injury)
--   - emergency_room_treatment
--   - hospitalized_overnight (triggers 24-hour OSHA reporting)
--   - physician_name
--   - treatment_facility
--   - time_began_work
--   - employee_hire_date
--
-- OSHA Tracking Fields:
--   - osha_reportable (requires OSHA notification)
--   - osha_reported (has been reported)
--   - osha_report_date (when reported)
-- =============================================================================

-- Add OSHA Case Number (auto-generated for recordable incidents)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS case_number VARCHAR(20);

COMMENT ON COLUMN public.safety_incidents.case_number IS 'OSHA 300: Unique case identifier (format: YYYY-###)';

-- Add Incident Time (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS incident_time TIME;

COMMENT ON COLUMN public.safety_incidents.incident_time IS 'OSHA 301: Time the incident occurred';

-- Add Injury/Illness Type Classification (OSHA 300)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS injury_illness_type TEXT 
  CHECK (injury_illness_type IS NULL OR injury_illness_type IN (
    'injury',
    'skin_disorder',
    'respiratory',
    'poisoning',
    'hearing_loss',
    'other_illness'
  ));

COMMENT ON COLUMN public.safety_incidents.injury_illness_type IS 'OSHA 300: Classification of injury/illness type';

-- Add Body Parts Affected (OSHA 300/301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS body_parts_affected TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.safety_incidents.body_parts_affected IS 'OSHA 300/301: Body part(s) affected by injury/illness';

-- Add What Employee Was Doing Before Incident (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS what_doing_before TEXT;

COMMENT ON COLUMN public.safety_incidents.what_doing_before IS 'OSHA 301: Activity employee was performing before incident';

-- Add Object/Substance That Harmed (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS object_substance_harmed TEXT;

COMMENT ON COLUMN public.safety_incidents.object_substance_harmed IS 'OSHA 301: Object or substance that directly harmed the employee';

-- Add Days Away From Work (OSHA 300)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS days_away_from_work INTEGER CHECK (days_away_from_work IS NULL OR days_away_from_work >= 0);

COMMENT ON COLUMN public.safety_incidents.days_away_from_work IS 'OSHA 300: Calendar days away from work (excluding day of injury)';

-- Add Days of Restricted Duty (OSHA 300)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS days_restricted_duty INTEGER CHECK (days_restricted_duty IS NULL OR days_restricted_duty >= 0);

COMMENT ON COLUMN public.safety_incidents.days_restricted_duty IS 'OSHA 300: Calendar days of restricted work or job transfer';

-- Add Emergency Room Treatment (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS emergency_room_treatment BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.safety_incidents.emergency_room_treatment IS 'OSHA 301: Was employee treated in emergency room?';

-- Add Hospitalized Overnight (OSHA 301 - Triggers 24-hour reporting)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS hospitalized_overnight BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.safety_incidents.hospitalized_overnight IS 'OSHA 301: Was employee hospitalized overnight? (Triggers 24-hour OSHA reporting)';

-- Add Physician Name (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS physician_name VARCHAR(200);

COMMENT ON COLUMN public.safety_incidents.physician_name IS 'OSHA 301: Name of physician or healthcare provider';

-- Add Treatment Facility (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS treatment_facility VARCHAR(200);

COMMENT ON COLUMN public.safety_incidents.treatment_facility IS 'OSHA 301: Name and address of treatment facility';

-- Add Employee Job Title (OSHA 300)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS employee_job_title VARCHAR(100);

COMMENT ON COLUMN public.safety_incidents.employee_job_title IS 'OSHA 300: Job title of injured/ill employee';

-- Add Time Began Work (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS time_began_work TIME;

COMMENT ON COLUMN public.safety_incidents.time_began_work IS 'OSHA 301: Time employee began work that day';

-- Add Employee Hire Date (OSHA 301)
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS employee_hire_date DATE;

COMMENT ON COLUMN public.safety_incidents.employee_hire_date IS 'OSHA 301: Date employee was hired';

-- =============================================================================
-- OSHA TRACKING FIELDS
-- =============================================================================

-- Add OSHA Reportable Flag
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS osha_reportable BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.safety_incidents.osha_reportable IS 'Does this incident require OSHA notification (fatality, hospitalization, amputation, loss of eye)?';

-- Add OSHA Reported Flag
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS osha_reported BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.safety_incidents.osha_reported IS 'Has this incident been reported to OSHA?';

-- Add OSHA Report Date
ALTER TABLE public.safety_incidents 
ADD COLUMN IF NOT EXISTS osha_report_date DATE;

COMMENT ON COLUMN public.safety_incidents.osha_report_date IS 'Date incident was reported to OSHA';

-- =============================================================================
-- INDEXES FOR NEW COLUMNS
-- =============================================================================

-- Index for case number lookups
CREATE INDEX IF NOT EXISTS idx_safety_incidents_case_number 
  ON safety_incidents(case_number) 
  WHERE case_number IS NOT NULL;

-- Index for OSHA reportable incidents
CREATE INDEX IF NOT EXISTS idx_safety_incidents_osha_reportable 
  ON safety_incidents(osha_reportable) 
  WHERE osha_reportable = true;

-- Index for hospitalization tracking (triggers 24-hour reporting)
CREATE INDEX IF NOT EXISTS idx_safety_incidents_hospitalized 
  ON safety_incidents(hospitalized_overnight) 
  WHERE hospitalized_overnight = true;

-- Composite index for OSHA compliance queries
CREATE INDEX IF NOT EXISTS idx_safety_incidents_osha_compliance 
  ON safety_incidents(incident_date, severity, osha_reportable);

-- =============================================================================
-- FUNCTION: Generate OSHA Case Number
-- =============================================================================
-- Generates case numbers in format YYYY-### (e.g., 2026-001)

CREATE OR REPLACE FUNCTION generate_osha_case_number()
RETURNS TEXT AS $$
DECLARE
  current_year INTEGER;
  next_number INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the next case number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN case_number ~ ('^' || current_year || '-[0-9]+$')
      THEN CAST(SUBSTRING(case_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM safety_incidents
  WHERE EXTRACT(YEAR FROM incident_date) = current_year;
  
  RETURN current_year || '-' || LPAD(next_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_osha_case_number() IS 'Generates OSHA-compliant case numbers in format YYYY-###';

-- =============================================================================
-- TRIGGER: Auto-generate case number for recordable incidents
-- =============================================================================

CREATE OR REPLACE FUNCTION auto_generate_case_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate case numbers for recordable, lost_time, and fatality
  IF NEW.severity IN ('recordable', 'lost_time', 'fatality') AND NEW.case_number IS NULL THEN
    NEW.case_number := generate_osha_case_number();
  END IF;
  
  -- Auto-set osha_reportable based on severity and hospitalization
  NEW.osha_reportable := (
    NEW.severity = 'fatality' OR 
    NEW.hospitalized_overnight = true OR
    NEW.severity IN ('recordable', 'lost_time')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_case_number ON public.safety_incidents;
CREATE TRIGGER trigger_auto_case_number
  BEFORE INSERT OR UPDATE ON public.safety_incidents
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_case_number();

-- =============================================================================
-- VIEW: OSHA 300 Log Ready Data
-- =============================================================================
-- Provides data in a format suitable for OSHA 300 Log export

CREATE OR REPLACE VIEW public.osha_300_log AS
SELECT
  si.case_number,
  CASE 
    WHEN si.severity = 'fatality' THEN 'Privacy Case'
    ELSE (
      SELECT full_name FROM app_users 
      WHERE user_id = ANY(si.involved_user_ids) 
      LIMIT 1
    )
  END AS employee_name,
  si.employee_job_title AS job_title,
  si.incident_date AS date_of_injury,
  si.work_site_name AS where_event_occurred,
  si.description || 
    CASE WHEN si.body_parts_affected IS NOT NULL AND array_length(si.body_parts_affected, 1) > 0 
      THEN ' | Body parts: ' || array_to_string(si.body_parts_affected, ', ')
      ELSE ''
    END AS description_with_body_parts,
  CASE si.severity
    WHEN 'fatality' THEN 'Death'
    WHEN 'lost_time' THEN 'Days Away From Work'
    WHEN 'recordable' THEN 
      CASE 
        WHEN si.days_restricted_duty > 0 THEN 'Job Transfer or Restriction'
        ELSE 'Other Recordable Cases'
      END
    ELSE 'N/A'
  END AS classification,
  COALESCE(si.days_away_from_work, 0) AS days_away,
  COALESCE(si.days_restricted_duty, 0) AS days_restricted,
  si.injury_illness_type,
  si.reported_at
FROM safety_incidents si
WHERE si.severity IN ('recordable', 'lost_time', 'fatality')
ORDER BY si.incident_date DESC, si.case_number;

COMMENT ON VIEW public.osha_300_log IS 'OSHA 300 Log format for recordable injuries/illnesses';

-- Grant access to the view
GRANT SELECT ON public.osha_300_log TO authenticated;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

-- Grant execute on the case number function
GRANT EXECUTE ON FUNCTION generate_osha_case_number() TO authenticated;
