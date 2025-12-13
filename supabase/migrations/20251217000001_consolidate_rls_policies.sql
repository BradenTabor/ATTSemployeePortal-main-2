/*
  ============================================================================
  CONSOLIDATED RLS POLICY MIGRATION
  ============================================================================
  
  This migration consolidates all RLS policies to ensure a clean, consistent
  security state across all tables. It is idempotent and can be run multiple
  times safely.
  
  Tables covered:
  - app_users (user roles - source of truth)
  - job_progress_trackers (jobs)
  - job_crew_assignments (user-job assignments)
  - job_milestones (job milestones)
  - job_progress_updates (span-based progress)
  - rto_requests (time off requests)
  
  Security Model:
  - All policies use (SELECT auth.uid()) for performance optimization
  - Admin checks use public.is_admin() helper function (from migration 20251212194400)
    to prevent infinite recursion - NEVER query app_users directly in policies
  - Users can read their own data
  - Admins have elevated privileges
  - app_users policies handled separately in migration 20251212194500 to prevent recursion
  
  ============================================================================
*/

-- ============================================================================
-- SECTION 1: app_users POLICIES
-- ============================================================================
-- NOTE: app_users policies are handled by migration 20251212194500_fix_app_users_rls_recursion.sql
-- to prevent infinite recursion. This section is intentionally left empty.
-- 
-- The fix migration creates simple, non-recursive policies:
-- - Users can SELECT their own record (user_id = auth.uid())
-- - Users can INSERT their own record (user_id = auth.uid())
-- - Admin operations use service role or SECURITY DEFINER functions
--
-- DO NOT add admin checks here that query app_users - it causes recursion!

-- ============================================================================
-- SECTION 2: job_progress_trackers POLICIES
-- ============================================================================
-- Main jobs table

DROP POLICY IF EXISTS "jobs_select_assigned" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_update_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_assigned_or_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Admins have full access to job_progress_trackers" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Users can read assigned jobs" ON public.job_progress_trackers;

ALTER TABLE public.job_progress_trackers ENABLE ROW LEVEL SECURITY;

-- Users can read jobs they're assigned to
CREATE POLICY "jobs_select_assigned"
  ON public.job_progress_trackers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_crew_assignments jca
      WHERE jca.job_id = job_progress_trackers.id
        AND jca.user_id = (SELECT auth.uid())
    )
  );

-- Admins can read all jobs
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "jobs_select_admin"
  ON public.job_progress_trackers
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can create jobs
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "jobs_insert_admin"
  ON public.job_progress_trackers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update jobs
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "jobs_update_admin"
  ON public.job_progress_trackers
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete jobs
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "jobs_delete_admin"
  ON public.job_progress_trackers
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 3: job_crew_assignments POLICIES
-- ============================================================================
-- Junction table linking users to jobs

DROP POLICY IF EXISTS "crew_assignments_select_own" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_select_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_insert_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_update_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_delete_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_select_own_or_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_insert_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_update_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_delete_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Admins have full access to job_crew_assignments" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Users can read own crew assignments" ON public.job_crew_assignments;

ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;

-- Users can read their own assignments
CREATE POLICY "crew_assignments_select_own"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read all assignments
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "crew_assignments_select_admin"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can create assignments
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "crew_assignments_insert_admin"
  ON public.job_crew_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update assignments
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "crew_assignments_update_admin"
  ON public.job_crew_assignments
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete assignments
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "crew_assignments_delete_admin"
  ON public.job_crew_assignments
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 4: job_milestones POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "milestones_select_assigned" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_insert_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_update_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_delete_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_assigned_or_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "Admins have full access to job_milestones" ON public.job_milestones;
DROP POLICY IF EXISTS "Users can read milestones for assigned jobs" ON public.job_milestones;

ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;

-- Users can read milestones for jobs they're assigned to
CREATE POLICY "milestones_select_assigned"
  ON public.job_milestones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_crew_assignments jca
      WHERE jca.job_id = job_milestones.job_id
        AND jca.user_id = (SELECT auth.uid())
    )
  );

-- Admins can read all milestones
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "milestones_select_admin"
  ON public.job_milestones
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can create milestones
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "milestones_insert_admin"
  ON public.job_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update milestones
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "milestones_update_admin"
  ON public.job_milestones
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete milestones
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "milestones_delete_admin"
  ON public.job_milestones
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 5: job_progress_updates POLICIES
-- ============================================================================
-- Span-based progress updates

DROP POLICY IF EXISTS "progress_updates_select_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_select_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_select" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete" ON public.job_progress_updates;
DROP POLICY IF EXISTS "Admins full access to job_progress_updates" ON public.job_progress_updates;
DROP POLICY IF EXISTS "Users can manage their own progress updates" ON public.job_progress_updates;

ALTER TABLE public.job_progress_updates ENABLE ROW LEVEL SECURITY;

-- Users can read their own progress updates
CREATE POLICY "progress_updates_select_own"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read all progress updates
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "progress_updates_select_admin"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Users can insert progress updates for jobs they're assigned to
CREATE POLICY "progress_updates_insert_own"
  ON public.job_progress_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.job_crew_assignments jca
      WHERE jca.job_id = job_progress_updates.job_id
        AND jca.user_id = (SELECT auth.uid())
    )
  );

-- Admins can insert for any job
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "progress_updates_insert_admin"
  ON public.job_progress_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Users can update their own updates
CREATE POLICY "progress_updates_update_own"
  ON public.job_progress_updates
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Admins can update any
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "progress_updates_update_admin"
  ON public.job_progress_updates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Users can delete their own
CREATE POLICY "progress_updates_delete_own"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can delete any
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "progress_updates_delete_admin"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 6: rto_requests POLICIES
-- ============================================================================
-- Time off requests

DROP POLICY IF EXISTS "Admins can view all RTO requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can insert time off requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can submit RTO requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.rto_requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_select_admin" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_insert_authenticated" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_update_admin" ON public.rto_requests;

ALTER TABLE public.rto_requests ENABLE ROW LEVEL SECURITY;

-- Admins can view all RTO requests
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "rto_select_admin"
  ON public.rto_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- All authenticated users can submit RTO requests
CREATE POLICY "rto_insert_authenticated"
  ON public.rto_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can update request status
-- Uses public.is_admin() helper function to avoid direct app_users queries
CREATE POLICY "rto_update_admin"
  ON public.rto_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- SECTION 7: UPDATE STATISTICS
-- ============================================================================

-- Note: app_users statistics updated in fix migration
ANALYZE public.job_progress_trackers;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_updates;
ANALYZE public.rto_requests;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
/*
-- Check all policies on key tables
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('app_users', 'job_progress_trackers', 'job_crew_assignments', 'job_milestones', 'job_progress_updates', 'rto_requests')
ORDER BY tablename, policyname;

-- Test: Can user fetch their own role?
-- (Policies for app_users are handled by fix migration 20251212194500)
-- SELECT role FROM public.app_users WHERE user_id = auth.uid();

-- Test: Can user see their assigned jobs?
SELECT * FROM public.job_crew_assignments WHERE user_id = auth.uid();
*/

