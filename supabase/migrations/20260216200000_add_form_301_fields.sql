-- Add OSHA Form 301 mandatory fields to safety_incidents
-- (employee address, DOB, sex, date of death, privacy case)

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS employee_street_address TEXT,
  ADD COLUMN IF NOT EXISTS employee_city TEXT,
  ADD COLUMN IF NOT EXISTS employee_state TEXT,
  ADD COLUMN IF NOT EXISTS employee_zip TEXT,
  ADD COLUMN IF NOT EXISTS employee_date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS employee_sex TEXT CHECK (employee_sex IN ('male', 'female', 'non_binary', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS date_of_death DATE,
  ADD COLUMN IF NOT EXISTS privacy_case BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.safety_incidents.employee_street_address IS 'OSHA 301: Employee street address';
COMMENT ON COLUMN public.safety_incidents.employee_city IS 'OSHA 301: Employee city';
COMMENT ON COLUMN public.safety_incidents.employee_state IS 'OSHA 301: Employee state (US abbreviation)';
COMMENT ON COLUMN public.safety_incidents.employee_zip IS 'OSHA 301: Employee ZIP code';
COMMENT ON COLUMN public.safety_incidents.employee_date_of_birth IS 'OSHA 301: Employee date of birth';
COMMENT ON COLUMN public.safety_incidents.employee_sex IS 'OSHA 301: Employee sex (male, female, non_binary, prefer_not_to_say)';
COMMENT ON COLUMN public.safety_incidents.date_of_death IS 'OSHA 301: Date of death (for fatality severity)';
COMMENT ON COLUMN public.safety_incidents.privacy_case IS 'OSHA 1904.12: Privacy concern case - do not enter employee name on log';
