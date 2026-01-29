-- Repair: ensure safety_incidents has case_number (and other OSHA columns used by get_incident_log_osha_300_301).
-- Safe to run if 20260120200000 or 20260301000002 were skipped or partially applied.

ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS case_number VARCHAR(20);
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS incident_time TIME;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS employee_job_title TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS what_doing_before TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS object_substance_harmed TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS body_parts_affected TEXT[] DEFAULT '{}';
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS injury_illness_type TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS days_away_from_work INTEGER;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS days_restricted_duty INTEGER;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS emergency_room_treatment BOOLEAN DEFAULT false;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS hospitalized_overnight BOOLEAN DEFAULT false;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS physician_name TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS treatment_facility TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS time_began_work TIME;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS employee_hire_date DATE;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS osha_reportable BOOLEAN DEFAULT false;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS osha_reported BOOLEAN DEFAULT false;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS osha_report_date DATE;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS crew_id UUID;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS supervisor_id UUID;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS corrective_actions_taken TEXT;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS corrective_actions_at TIMESTAMPTZ;

COMMENT ON COLUMN public.safety_incidents.case_number IS 'OSHA 300: Unique case identifier (format: YYYY-###)';
