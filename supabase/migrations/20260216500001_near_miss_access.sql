-- =============================================================================
-- Migration: Near-miss reporting access for all authenticated users
-- Allows any authenticated user to insert safety_incidents with severity='near_miss'.
-- OSHA 29 CFR 1904.7: Near-misses support proactive safety culture.
-- =============================================================================

-- Extend incident_type to include 'near_miss' for near-miss reports
ALTER TABLE public.safety_incidents
  DROP CONSTRAINT IF EXISTS safety_incidents_incident_type_check;

ALTER TABLE public.safety_incidents
  ADD CONSTRAINT safety_incidents_incident_type_check
  CHECK (incident_type IN ('fall','electrical','vehicle','equipment','environmental','struck_by','caught_in','other','near_miss'));

-- Function: true for ALL authenticated roles (any user can report near-miss)
CREATE OR REPLACE FUNCTION public.can_report_near_miss()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

COMMENT ON FUNCTION public.can_report_near_miss() IS
  'Returns true for any authenticated user. Used for near-miss RLS policy.';

GRANT EXECUTE ON FUNCTION public.can_report_near_miss() TO authenticated;

-- JSONB for near-miss-specific data (category, lat/lng, photo_paths)
ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS near_miss_data JSONB DEFAULT NULL;

COMMENT ON COLUMN public.safety_incidents.near_miss_data IS
  'Near-miss specific: category, latitude, longitude, suggested_corrective_action, photo_paths';

-- RLS policy: any authenticated user can INSERT when severity = 'near_miss'
-- Additive to existing admin INSERT policy; does not conflict.
CREATE POLICY safety_incidents_near_miss_insert ON public.safety_incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_report_near_miss()
    AND (severity = 'near_miss')
  );
