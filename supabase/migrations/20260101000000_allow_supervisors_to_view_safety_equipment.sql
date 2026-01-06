/*
  ============================================================================
  ALLOW SUPERVISORY ROLES TO VIEW JSA, DVIR, AND EQUIPMENT INSPECTIONS
  ============================================================================
  Description: Update RLS policies to allow general_foreman, foreman, and 
               safety_officer roles to view all JSA, DVIR, and equipment 
               inspection records for safety compliance oversight.
  Date: 2026-01-01
  
  Reason: General foremen need to see all crew safety submissions when 
          viewing the Safety Compliance and Equipment Logs pages. Currently 
          only admins can see all records, causing no data to display for 
          supervisory roles.
  
  Changes:
  1. Add supervisor SELECT policy to daily_jsa table
  2. Add supervisor SELECT policy to dvir_reports table  
  3. Add supervisor SELECT policy to daily_equipment_inspections table
  
  Uses the existing is_supervisor() helper function from migration
  20251231060000_allow_supervisors_to_view_users.sql
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: UPDATE daily_jsa SELECT POLICIES
-- ============================================================================
-- Allow supervisors to view all JSA records (for Safety Compliance page)

-- First, check if the table exists and has RLS enabled
DO $$
BEGIN
  -- Ensure RLS is enabled on the table
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'daily_jsa'
  ) THEN
    EXECUTE 'ALTER TABLE public.daily_jsa ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE 'RLS enabled on daily_jsa';
  ELSE
    RAISE WARNING 'Table daily_jsa does not exist - skipping';
  END IF;
END $$;

-- Drop existing supervisor policy if it exists (for idempotency)
DROP POLICY IF EXISTS "jsa_supervisor_select" ON public.daily_jsa;

-- Create new supervisor SELECT policy
-- Supervisors can read all JSA records
CREATE POLICY "jsa_supervisor_select"
  ON public.daily_jsa
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "jsa_supervisor_select" ON public.daily_jsa IS 
  'Supervisory roles (admin, general_foreman, foreman, safety_officer) can view all JSA records for safety compliance oversight.';

-- ============================================================================
-- STEP 2: UPDATE dvir_reports SELECT POLICIES
-- ============================================================================
-- Allow supervisors to view all DVIR reports (for Equipment Logs page)

-- Drop existing supervisor policy if it exists (for idempotency)
DROP POLICY IF EXISTS "dvir_supervisor_select" ON public.dvir_reports;

-- Create new supervisor SELECT policy
-- Supervisors can read all DVIR reports
CREATE POLICY "dvir_supervisor_select"
  ON public.dvir_reports
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "dvir_supervisor_select" ON public.dvir_reports IS 
  'Supervisory roles (admin, general_foreman, foreman, safety_officer) can view all DVIR reports for equipment oversight.';

-- ============================================================================
-- STEP 3: UPDATE daily_equipment_inspections SELECT POLICIES
-- ============================================================================
-- Allow supervisors to view all equipment inspections (for Equipment Logs page)

-- Drop existing supervisor policy if it exists (for idempotency)
DROP POLICY IF EXISTS "equipment_inspection_supervisor_select" ON public.daily_equipment_inspections;

-- Create new supervisor SELECT policy
-- Supervisors can read all equipment inspections
CREATE POLICY "equipment_inspection_supervisor_select"
  ON public.daily_equipment_inspections
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "equipment_inspection_supervisor_select" ON public.daily_equipment_inspections IS 
  'Supervisory roles (admin, general_foreman, foreman, safety_officer) can view all equipment inspections for oversight.';

-- ============================================================================
-- STEP 4: ANALYZE FOR PERFORMANCE
-- ============================================================================

-- Only analyze if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_jsa') THEN
    ANALYZE public.daily_jsa;
  END IF;
END $$;

ANALYZE public.dvir_reports;
ANALYZE public.daily_equipment_inspections;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================================
/*
-- Check daily_jsa policies
SELECT policyname, cmd, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'daily_jsa';

-- Check dvir_reports policies  
SELECT policyname, cmd, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'dvir_reports';

-- Check daily_equipment_inspections policies
SELECT policyname, cmd, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'daily_equipment_inspections';

-- Test as general_foreman (switch to a general_foreman user's session):
--   SELECT COUNT(*) FROM daily_jsa; -- Should return all records
--   SELECT COUNT(*) FROM dvir_reports; -- Should return all records
--   SELECT COUNT(*) FROM daily_equipment_inspections; -- Should return all records
*/


