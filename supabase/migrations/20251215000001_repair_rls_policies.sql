/*
  # RLS Policy Repair Migration
  
  This migration repairs the RLS policies that were causing issues with:
  1. User role fetching not working (users couldn't read their own app_users record)
  2. Assigned jobs not showing (job_crew_assignments access was broken)
  
  ## Root Cause
  The previous migrations created policies that:
  - Did not use (SELECT auth.uid()) causing per-row re-evaluation
  - Had circular dependencies in some cases
  
  ## Fix Strategy
  - Users can ALWAYS read their own records (simple user_id = (SELECT auth.uid()) check)
  - Admin checks are kept simple and non-circular
  - Use (SELECT auth.uid()) for performance optimization
*/

-- ============================================================================
-- SECTION 1: FIX app_users POLICIES (Critical for role fetching)
-- ============================================================================
-- Users MUST be able to read their own record to get their role
-- This is the foundational query that AuthContext.tsx uses

-- First, drop all existing app_users policies to start fresh
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.app_users;
DROP POLICY IF EXISTS "users_insert_own" ON public.app_users;
DROP POLICY IF EXISTS "admins_update_roles" ON public.app_users;
DROP POLICY IF EXISTS "admins_delete_users" ON public.app_users;
DROP POLICY IF EXISTS "Users can read own role" ON public.app_users;
DROP POLICY IF EXISTS "System can insert new users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.app_users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.app_users;
DROP POLICY IF EXISTS "app_users_select_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_select_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_insert_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_delete_admin" ON public.app_users;

-- Policy 1: ALL authenticated users can read their OWN record (required for role fetch)
-- This is the critical policy for role fetching in AuthContext.tsx
CREATE POLICY "app_users_select_own"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 2: Admins can read ALL records (for user management)
CREATE POLICY "app_users_select_admin"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users admin_check
      WHERE admin_check.user_id = (SELECT auth.uid())
        AND admin_check.role = 'admin'
    )
  );

-- Policy 3: User/system can insert their own record (for new user registration)
CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy 4: Admins can update any user's role
CREATE POLICY "app_users_update_admin"
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users admin_check
      WHERE admin_check.user_id = (SELECT auth.uid())
        AND admin_check.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users admin_check
      WHERE admin_check.user_id = (SELECT auth.uid())
        AND admin_check.role = 'admin'
    )
  );

-- Policy 5: Admins can delete other users (not themselves)
CREATE POLICY "app_users_delete_admin"
  ON public.app_users
  FOR DELETE
  TO authenticated
  USING (
    user_id != (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.app_users admin_check
      WHERE admin_check.user_id = (SELECT auth.uid())
        AND admin_check.role = 'admin'
    )
  );

-- ============================================================================
-- SECTION 2: FIX job_crew_assignments POLICIES (Critical for assigned jobs)
-- ============================================================================
-- Users need to be able to read their own crew assignments to see assigned jobs

DROP POLICY IF EXISTS "crew_select_own_or_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_insert_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_update_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_delete_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Admins have full access to job_crew_assignments" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "Users can read own crew assignments" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_select_own" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_select_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_insert_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_update_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_delete_admin" ON public.job_crew_assignments;

-- Policy 1: Users can read their OWN assignments
CREATE POLICY "crew_assignments_select_own"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 2: Admins can read ALL assignments
CREATE POLICY "crew_assignments_select_admin"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 3: Admins can insert assignments
CREATE POLICY "crew_assignments_insert_admin"
  ON public.job_crew_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 4: Admins can update assignments
CREATE POLICY "crew_assignments_update_admin"
  ON public.job_crew_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 5: Admins can delete assignments
CREATE POLICY "crew_assignments_delete_admin"
  ON public.job_crew_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- ============================================================================
-- SECTION 3: FIX job_progress_trackers POLICIES (Jobs table)
-- ============================================================================
-- Users see jobs they're assigned to, admins see all

DROP POLICY IF EXISTS "jobs_select_assigned_or_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_update_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Admins have full access to job_progress_trackers" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Users can read assigned jobs" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_assigned" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_admin" ON public.job_progress_trackers;

-- Policy 1: Users can read jobs they're assigned to
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

-- Policy 2: Admins can read ALL jobs
CREATE POLICY "jobs_select_admin"
  ON public.job_progress_trackers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 3: Admins can insert
CREATE POLICY "jobs_insert_admin"
  ON public.job_progress_trackers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 4: Admins can update
CREATE POLICY "jobs_update_admin"
  ON public.job_progress_trackers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 5: Admins can delete
CREATE POLICY "jobs_delete_admin"
  ON public.job_progress_trackers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- ============================================================================
-- SECTION 4: FIX job_milestones POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "milestones_select_assigned_or_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_insert_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_update_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_delete_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "Admins have full access to job_milestones" ON public.job_milestones;
DROP POLICY IF EXISTS "Users can read milestones for assigned jobs" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_assigned" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_admin" ON public.job_milestones;

-- Policy 1: Users can read milestones for jobs they're assigned to
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

-- Policy 2: Admins can read all milestones
CREATE POLICY "milestones_select_admin"
  ON public.job_milestones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 3: Admins can insert
CREATE POLICY "milestones_insert_admin"
  ON public.job_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 4: Admins can update
CREATE POLICY "milestones_update_admin"
  ON public.job_milestones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 5: Admins can delete
CREATE POLICY "milestones_delete_admin"
  ON public.job_milestones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- ============================================================================
-- SECTION 5: FIX job_progress_updates POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "progress_updates_select" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete" ON public.job_progress_updates;
DROP POLICY IF EXISTS "Admins full access to job_progress_updates" ON public.job_progress_updates;
DROP POLICY IF EXISTS "Users can manage their own progress updates" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_select_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_select_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete_admin" ON public.job_progress_updates;

-- Policy 1: Users can read their own progress updates
CREATE POLICY "progress_updates_select_own"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 2: Admins can read all progress updates
CREATE POLICY "progress_updates_select_admin"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 3: Users can insert for jobs they're assigned to
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

-- Policy 4: Admins can insert for any job
CREATE POLICY "progress_updates_insert_admin"
  ON public.job_progress_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 5: Users can update their own updates
CREATE POLICY "progress_updates_update_own"
  ON public.job_progress_updates
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy 6: Admins can update any
CREATE POLICY "progress_updates_update_admin"
  ON public.job_progress_updates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- Policy 7: Users can delete their own
CREATE POLICY "progress_updates_delete_own"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 8: Admins can delete any
CREATE POLICY "progress_updates_delete_admin"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = (SELECT auth.uid())
        AND au.role = 'admin'
    )
  );

-- ============================================================================
-- SECTION 6: ENSURE RLS IS ENABLED ON ALL TABLES
-- ============================================================================

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 7: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.app_users;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_progress_trackers;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_updates;

-- ============================================================================
-- VERIFICATION QUERY (Run manually to check policies)
-- ============================================================================
/*
-- Test: Can user fetch their own role?
SELECT role FROM public.app_users WHERE user_id = auth.uid();

-- Test: Can user see their assigned jobs?
SELECT * FROM public.job_crew_assignments WHERE user_id = auth.uid();

-- Check all policies on app_users
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'app_users';
*/

