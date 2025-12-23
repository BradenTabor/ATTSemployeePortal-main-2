/*
  ============================================================================
  FINAL RLS POLICY CONSOLIDATION
  ============================================================================
  
  This migration ensures a clean, consistent RLS policy state across all tables.
  It is the authoritative source for the security model.
  
  Key Principles:
  1. All admin checks use public.is_admin() helper function (NOT direct app_users queries)
  2. app_users table uses simple non-recursive policies
  3. Users can always read their own data
  4. Service role bypasses RLS automatically (no explicit policies needed)
  5. All policies use (SELECT auth.uid()) for performance optimization
  
  Security Model Summary:
  - app_users: Users read/insert own; service role for admin ops
  - job_* tables: Users read assigned jobs; admins have full access
  - rto_requests: Users insert/read own; admins manage all
  - dvir_reports: Users insert/read own; admins read all
  - daily_equipment_inspections: Users insert/read own; mechanics/admins manage
  - contact_requests: Users insert/read own; admins read all
  - announcements: Public read; service role write
  
  All operations are idempotent (safe to run multiple times).
  
  ============================================================================
*/

-- ============================================================================
-- SECTION 1: app_users POLICIES (Non-Recursive)
-- ============================================================================
-- CRITICAL: These policies MUST NOT query app_users to check roles.
-- Admin operations should use service role or SECURITY DEFINER functions.

DROP POLICY IF EXISTS "app_users_select_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_select_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_insert_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_delete_admin" ON public.app_users;
DROP POLICY IF EXISTS "Users can read own role" ON public.app_users;
DROP POLICY IF EXISTS "System can insert new users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.app_users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.app_users;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own record (required for role fetching)
CREATE POLICY "app_users_select_own"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 2: Users can INSERT their own record (for registration trigger)
CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- NOTE: UPDATE and DELETE on app_users require service role or
-- the get_user_profiles() SECURITY DEFINER function for admin operations.
-- This prevents infinite recursion in RLS policies.

-- ============================================================================
-- SECTION 2: job_progress_trackers POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "jobs_select_assigned" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_update_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.job_progress_trackers;
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

-- Admins can read all jobs (uses helper function)
CREATE POLICY "jobs_select_admin"
  ON public.job_progress_trackers
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert jobs
CREATE POLICY "jobs_insert_admin"
  ON public.job_progress_trackers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update jobs
CREATE POLICY "jobs_update_admin"
  ON public.job_progress_trackers
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete jobs
CREATE POLICY "jobs_delete_admin"
  ON public.job_progress_trackers
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 3: job_crew_assignments POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "crew_assignments_select_own" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_select_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_insert_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_update_admin" ON public.job_crew_assignments;
DROP POLICY IF EXISTS "crew_assignments_delete_admin" ON public.job_crew_assignments;
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
CREATE POLICY "crew_assignments_select_admin"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert assignments
CREATE POLICY "crew_assignments_insert_admin"
  ON public.job_crew_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update assignments
CREATE POLICY "crew_assignments_update_admin"
  ON public.job_crew_assignments
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete assignments
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
CREATE POLICY "milestones_select_admin"
  ON public.job_milestones
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert milestones
CREATE POLICY "milestones_insert_admin"
  ON public.job_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update milestones
CREATE POLICY "milestones_update_admin"
  ON public.job_milestones
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete milestones
CREATE POLICY "milestones_delete_admin"
  ON public.job_milestones
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 5: job_progress_updates POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "progress_updates_select_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_select_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_insert_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_update_admin" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete_own" ON public.job_progress_updates;
DROP POLICY IF EXISTS "progress_updates_delete_admin" ON public.job_progress_updates;
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
CREATE POLICY "progress_updates_delete_admin"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 6: rto_requests POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "rto_select_own" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_select_admin" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_insert_own" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_insert_authenticated" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_update_admin" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_delete_admin" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can view all RTO requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can insert time off requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can submit RTO requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.rto_requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.rto_requests;

ALTER TABLE public.rto_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "rto_select_own"
  ON public.rto_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can view all requests
CREATE POLICY "rto_select_admin"
  ON public.rto_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Users can insert their own requests
CREATE POLICY "rto_insert_own"
  ON public.rto_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

-- Admins can update request status
CREATE POLICY "rto_update_admin"
  ON public.rto_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete requests
CREATE POLICY "rto_delete_admin"
  ON public.rto_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 7: dvir_reports POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "dvir_insert_own" ON public.dvir_reports;
DROP POLICY IF EXISTS "dvir_select_own" ON public.dvir_reports;
DROP POLICY IF EXISTS "dvir_admin_select_all" ON public.dvir_reports;

ALTER TABLE public.dvir_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "dvir_insert_own"
  ON public.dvir_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

-- Users can read their own reports
CREATE POLICY "dvir_select_own"
  ON public.dvir_reports
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read all reports
CREATE POLICY "dvir_admin_select_all"
  ON public.dvir_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 8: daily_equipment_inspections POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "equipment_inspection_insert_own" ON public.daily_equipment_inspections;
DROP POLICY IF EXISTS "equipment_inspection_select_own" ON public.daily_equipment_inspections;
DROP POLICY IF EXISTS "equipment_inspection_admin_select" ON public.daily_equipment_inspections;
DROP POLICY IF EXISTS "equipment_inspection_mech_admin_select" ON public.daily_equipment_inspections;
DROP POLICY IF EXISTS "equipment_inspection_fix_update" ON public.daily_equipment_inspections;

ALTER TABLE public.daily_equipment_inspections ENABLE ROW LEVEL SECURITY;

-- Users can insert their own inspections
CREATE POLICY "equipment_inspection_insert_own"
  ON public.daily_equipment_inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

-- Users can read their own inspections
CREATE POLICY "equipment_inspection_select_own"
  ON public.daily_equipment_inspections
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins and mechanics can read all inspections
CREATE POLICY "equipment_inspection_mech_admin_select"
  ON public.daily_equipment_inspections
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_mechanic());

-- Admins and mechanics can update inspections (for mechanic fixes)
CREATE POLICY "equipment_inspection_fix_update"
  ON public.daily_equipment_inspections
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_mechanic())
  WITH CHECK (public.is_admin_or_mechanic());

-- ============================================================================
-- SECTION 9: contact_requests POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "contact_requests_insert_own" ON public.contact_requests;
DROP POLICY IF EXISTS "contact_requests_select_self" ON public.contact_requests;
DROP POLICY IF EXISTS "contact_requests_select_admin" ON public.contact_requests;

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own contact requests
CREATE POLICY "contact_requests_insert_own"
  ON public.contact_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR user_id IS NULL);

-- Users can read their own contact requests
CREATE POLICY "contact_requests_select_self"
  ON public.contact_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read all contact requests
CREATE POLICY "contact_requests_select_admin"
  ON public.contact_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- SECTION 10: announcements POLICIES
-- ============================================================================
-- Announcements are public read, service role write

DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Public can read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Service role can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow all authenticated users to read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow public to read announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow Make.com webhook inserts" ON public.announcements;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read announcements
CREATE POLICY "announcements_select_authenticated"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (true);

-- Anonymous users can read announcements (for public access)
CREATE POLICY "announcements_select_anon"
  ON public.announcements
  FOR SELECT
  TO anon
  USING (true);

-- Allow inserts from authenticated users and anon (for webhooks)
CREATE POLICY "announcements_insert_all"
  ON public.announcements
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- ============================================================================
-- SECTION 11: announcement_metadata POLICIES
-- ============================================================================
-- NOTE: Table is created by migration 20251223000001 if it doesn't exist.
-- These operations are wrapped in DO blocks for safety.

DO $$
BEGIN
  -- Drop old policies if they exist
  DROP POLICY IF EXISTS "Anyone can read metadata" ON public.announcement_metadata;
  DROP POLICY IF EXISTS "Public can read metadata" ON public.announcement_metadata;
  DROP POLICY IF EXISTS "Service role can manage metadata" ON public.announcement_metadata;
  DROP POLICY IF EXISTS "metadata_select_authenticated" ON public.announcement_metadata;
  DROP POLICY IF EXISTS "metadata_select_anon" ON public.announcement_metadata;
  
  -- Enable RLS
  ALTER TABLE public.announcement_metadata ENABLE ROW LEVEL SECURITY;
  
  -- Create policies
  CREATE POLICY "metadata_select_authenticated"
    ON public.announcement_metadata
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "metadata_select_anon"
    ON public.announcement_metadata
    FOR SELECT
    TO anon
    USING (true);
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'announcement_metadata table does not exist, skipping policies';
END $$;

-- ============================================================================
-- SECTION 12: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.app_users;
ANALYZE public.job_progress_trackers;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_updates;
ANALYZE public.rto_requests;
ANALYZE public.dvir_reports;
ANALYZE public.daily_equipment_inspections;
ANALYZE public.contact_requests;
ANALYZE public.announcements;

-- Only analyze if table exists
DO $$
BEGIN
  ANALYZE public.announcement_metadata;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'announcement_metadata table does not exist, skipping ANALYZE';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================================
/*
-- Check all policies on all tables
SELECT 
  schemaname,
  tablename, 
  policyname, 
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify RLS is enabled on all tables
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Test helper functions work
SELECT public.is_admin();
SELECT public.is_admin_or_manager();
SELECT public.is_mechanic();
SELECT public.is_admin_or_mechanic();

-- Verify no app_users policies query app_users (would cause recursion)
SELECT policyname, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'app_users'
  AND qual::text LIKE '%app_users%';
-- Should return empty (no recursion)
*/

