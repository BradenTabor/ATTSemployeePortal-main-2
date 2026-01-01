/*
  ============================================================================
  ALLOW SUPERVISORY ROLES TO VIEW ALL USER PROFILES AND JOBS
  ============================================================================
  Description: Update RLS policies to allow general_foreman, foreman, and 
               safety_officer roles to view all user profiles and jobs for crew oversight
  Date: 2025-12-31
  
  Reason: General foremen need to see all crew member names and all jobs when 
          viewing the Crew Oversight page. Currently only admins can see all 
          users and jobs, causing crew names to be missing and limiting job 
          visibility for supervisory roles.
  
  Changes:
  1. Create is_supervisor() helper function for supervisory role checks
  2. Update app_users SELECT policy to include supervisory roles
  3. Update job_progress_trackers SELECT policy to include supervisory roles
  4. Update job_crew_assignments SELECT policy to include supervisory roles
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: CREATE is_supervisor() HELPER FUNCTION
-- ============================================================================
-- Returns true if the current user is an admin, general_foreman, foreman, or safety_officer
-- These roles need to view all user profiles and jobs for crew management purposes

DROP FUNCTION IF EXISTS public.is_supervisor();

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'general_foreman', 'foreman', 'safety_officer')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;

COMMENT ON FUNCTION public.is_supervisor() IS 
  'Returns true if the current authenticated user has a supervisory role (admin, general_foreman, foreman, or safety_officer). Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_supervisor() TO authenticated;

-- ============================================================================
-- STEP 2: UPDATE app_users SELECT POLICY
-- ============================================================================
-- Drop the existing policies and recreate with supervisor access

DROP POLICY IF EXISTS "app_users_select_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_select_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_select_policy" ON public.app_users;

-- Create consolidated SELECT policy: supervisors can view all, others see only themselves
CREATE POLICY "app_users_select_policy"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor() OR user_id = auth.uid());

COMMENT ON POLICY "app_users_select_policy" ON public.app_users IS 
  'Supervisory roles (admin, general_foreman, foreman, safety_officer) can view all users. Regular users can only see their own record.';

-- ============================================================================
-- STEP 3: UPDATE job_progress_trackers SELECT POLICY
-- ============================================================================
-- Allow supervisors to view all jobs (for Crew Oversight)

DROP POLICY IF EXISTS "jobs_select_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_supervisor" ON public.job_progress_trackers;

-- Supervisors (including general_foreman) can read all jobs
CREATE POLICY "jobs_select_supervisor"
  ON public.job_progress_trackers
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "jobs_select_supervisor" ON public.job_progress_trackers IS 
  'Supervisory roles can view all jobs for crew oversight purposes.';

-- ============================================================================
-- STEP 4: UPDATE job_crew_assignments SELECT POLICY
-- ============================================================================
-- Allow supervisors to view all crew assignments (for Crew Oversight)

DROP POLICY IF EXISTS "crew_assignments_select_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_select_supervisor" ON public.job_crew_assignments;

-- Supervisors can read all assignments
CREATE POLICY "crew_assignments_select_supervisor"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "crew_assignments_select_supervisor" ON public.job_crew_assignments IS 
  'Supervisory roles can view all crew assignments for oversight purposes.';

-- ============================================================================
-- STEP 5: UPDATE job_milestones SELECT POLICY
-- ============================================================================
-- Allow supervisors to view all milestones

DROP POLICY IF EXISTS "milestones_select_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_supervisor" ON public.job_milestones;

-- Supervisors can read all milestones
CREATE POLICY "milestones_select_supervisor"
  ON public.job_milestones
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "milestones_select_supervisor" ON public.job_milestones IS 
  'Supervisory roles can view all job milestones for oversight purposes.';

-- ============================================================================
-- STEP 6: UPDATE job_progress_updates SELECT POLICY
-- ============================================================================
-- Allow supervisors to view all progress updates

DROP POLICY IF EXISTS "progress_updates_select_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_select_supervisor" ON public.job_progress_updates;

-- Supervisors can read all progress updates
CREATE POLICY "progress_updates_select_supervisor"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (public.is_supervisor());

COMMENT ON POLICY "progress_updates_select_supervisor" ON public.job_progress_updates IS 
  'Supervisory roles can view all job progress updates for oversight purposes.';

-- ============================================================================
-- STEP 7: ANALYZE FOR PERFORMANCE
-- ============================================================================

ANALYZE public.app_users;
ANALYZE public.job_progress_trackers;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_updates;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================================
/*
-- Test the new helper function
SELECT public.is_supervisor();

-- Check app_users policy
SELECT policyname, cmd, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'app_users';

-- Check job policies
SELECT policyname, cmd, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'job_progress_trackers';

-- Test as different roles (switch to each user's session):
-- As general_foreman: 
--   SELECT * FROM user_profiles; -- Should return all users
--   SELECT * FROM job_progress_trackers; -- Should return all jobs
-- As employee: 
--   SELECT * FROM user_profiles; -- Should return only own record
--   SELECT * FROM job_progress_trackers; -- Should return only assigned jobs
*/

