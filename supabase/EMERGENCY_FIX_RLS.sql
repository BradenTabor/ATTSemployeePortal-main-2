/*
  ============================================================================
  EMERGENCY RLS FIX - Run this in Supabase SQL Editor
  ============================================================================
  
  This script fixes the RLS policies that are blocking:
  1. User role fetching (app_users table)
  2. Assigned jobs visibility (job_crew_assignments table)
  
  HOW TO USE:
  1. Go to Supabase Dashboard > SQL Editor
  2. Copy and paste this entire script
  3. Click "Run"
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: Fix app_users policies (CRITICAL - enables role fetching)
-- ============================================================================

-- Drop ALL existing app_users policies
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

-- NEW POLICY 1: Users can ALWAYS read their OWN record
-- This is the critical policy for role fetching in AuthContext.tsx
CREATE POLICY "app_users_select_own"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- NEW POLICY 2: Admins can read ALL records  
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

-- NEW POLICY 3: Insert own record (for registration)
CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- NEW POLICY 4: Admins can update
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

-- NEW POLICY 5: Admins can delete (but not themselves)
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
-- STEP 2: Fix job_crew_assignments policies (for assigned jobs)
-- ============================================================================

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

-- Users can read their OWN assignments
CREATE POLICY "crew_assignments_select_own"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read ALL assignments
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

-- Admins can insert assignments
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

-- Admins can update
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

-- Admins can delete
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
-- STEP 3: Fix job_progress_trackers policies
-- ============================================================================

DROP POLICY IF EXISTS "jobs_select_assigned_or_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_update_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Admins have full access to job_progress_trackers" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Users can read assigned jobs" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_assigned" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_admin" ON public.job_progress_trackers;

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

-- Admins can read ALL jobs
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

-- Admins can insert
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

-- Admins can update
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

-- Admins can delete
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
-- STEP 4: Fix job_milestones policies
-- ============================================================================

DROP POLICY IF EXISTS "milestones_select_assigned_or_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_insert_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_update_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_delete_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "Admins have full access to job_milestones" ON public.job_milestones;
DROP POLICY IF EXISTS "Users can read milestones for assigned jobs" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_assigned" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_admin" ON public.job_milestones;

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

-- Admins can insert
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

-- Admins can update
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

-- Admins can delete
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
-- STEP 5: Fix job_progress_updates policies
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

-- Users can read their own progress updates
CREATE POLICY "progress_updates_select_own"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read all progress updates
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

-- Users can insert for jobs they're assigned to
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

-- Users can update their own updates
CREATE POLICY "progress_updates_update_own"
  ON public.job_progress_updates
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Admins can update any
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

-- Users can delete their own
CREATE POLICY "progress_updates_delete_own"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can delete any
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
-- STEP 6: Ensure RLS is enabled
-- ============================================================================

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 7: Update statistics
-- ============================================================================

ANALYZE public.app_users;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_progress_trackers;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_updates;

-- ============================================================================
-- VERIFICATION: Run these queries to verify everything works
-- ============================================================================

-- Test 1: Check that policies were created
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('app_users', 'job_crew_assignments', 'job_progress_trackers', 'job_milestones', 'job_progress_updates')
ORDER BY tablename, policyname;

-- Note: After running this script, refresh your browser and test:
-- 1. User role should be detected correctly
-- 2. Assigned jobs should appear on the dashboard

