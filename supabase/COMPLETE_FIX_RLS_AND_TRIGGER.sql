/*
  ============================================================================
  COMPLETE FIX - RLS Policies, Trigger, and View
  ============================================================================
  
  This script fixes ALL issues causing role detection and job visibility problems:
  
  1. TRIGGER FIX: The handle_new_user() trigger was using wrong column name
  2. VIEW FIX: user_profiles view was missing full_name column
  3. RLS FIX: Ensures all RLS policies are correctly configured
  4. DATA REPAIR: Syncs missing email data
  
  HOW TO USE:
  1. Go to Supabase Dashboard > SQL Editor
  2. Copy and paste this entire script
  3. Click "Run"
  4. Refresh your app and log in again
  
  ============================================================================
*/

-- ============================================================================
-- PART 1: FIX THE TRIGGER FUNCTION (ROOT CAUSE OF ROLE ISSUES)
-- ============================================================================
-- The previous version incorrectly used 'id' instead of 'user_id'

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name text;
  v_dl_number text;
  v_dl_class text;
  v_dl_exp text;
BEGIN
  -- Extract metadata fields from raw_user_meta_data
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_dl_number := new.raw_user_meta_data->>'drivers_license_number';
  v_dl_class  := new.raw_user_meta_data->>'drivers_license_class';
  v_dl_exp    := new.raw_user_meta_data->>'drivers_license_expiration';

  -- Upsert into app_users using CORRECT column (user_id, not id)
  INSERT INTO public.app_users (
    user_id,  -- CORRECT: use user_id (FK to auth.users)
    email,
    full_name,
    drivers_license_number,
    drivers_license_class,
    drivers_license_expiration,
    role
  )
  VALUES (
    new.id,   -- auth.users.id goes into user_id column
    new.email,
    v_full_name,
    v_dl_number,
    v_dl_class,
    v_dl_exp,
    'employee'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    drivers_license_number = EXCLUDED.drivers_license_number,
    drivers_license_class = EXCLUDED.drivers_license_class,
    drivers_license_expiration = EXCLUDED.drivers_license_expiration;
    -- NOTE: Role is NOT updated on conflict to preserve admin/mechanic roles

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 2: UPDATE user_profiles VIEW TO INCLUDE full_name
-- ============================================================================

CREATE OR REPLACE VIEW user_profiles AS
SELECT
  app.id,
  app.user_id,
  au.email,
  app.full_name,
  app.role,
  app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

-- ============================================================================
-- PART 3: UPDATE get_user_profiles FUNCTION
-- ============================================================================
-- Must DROP first because we're changing the return type (adding full_name column)

DROP FUNCTION IF EXISTS get_user_profiles();

CREATE OR REPLACE FUNCTION get_user_profiles()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_users au
    WHERE au.user_id = auth.uid() 
    AND au.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    up.id,
    up.user_id,
    up.email,
    up.full_name,
    up.role,
    up.created_at
  FROM user_profiles up
  ORDER BY up.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_profiles() TO authenticated;

-- ============================================================================
-- PART 4: FIX app_users RLS POLICIES
-- ============================================================================

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

-- Users can read their OWN record (required for role fetch)
CREATE POLICY "app_users_select_own"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Admins can read ALL records
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

-- Insert own record (for registration)
CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Admins can update
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

-- Admins can delete (but not themselves)
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
-- PART 5: FIX job_crew_assignments RLS POLICIES
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

CREATE POLICY "crew_assignments_select_own"
  ON public.job_crew_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

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
-- PART 6: FIX job_progress_trackers RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "jobs_select_assigned_or_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_update_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Admins have full access to job_progress_trackers" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "Users can read assigned jobs" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_assigned" ON public.job_progress_trackers;
DROP POLICY IF EXISTS "jobs_select_admin" ON public.job_progress_trackers;

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
-- PART 7: FIX job_milestones RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "milestones_select_assigned_or_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_insert_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_update_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_delete_admin" ON public.job_milestones;
DROP POLICY IF EXISTS "Admins have full access to job_milestones" ON public.job_milestones;
DROP POLICY IF EXISTS "Users can read milestones for assigned jobs" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_assigned" ON public.job_milestones;
DROP POLICY IF EXISTS "milestones_select_admin" ON public.job_milestones;

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
-- PART 8: FIX job_progress_updates RLS POLICIES
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

CREATE POLICY "progress_updates_select_own"
  ON public.job_progress_updates
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

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

CREATE POLICY "progress_updates_update_own"
  ON public.job_progress_updates
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

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

CREATE POLICY "progress_updates_delete_own"
  ON public.job_progress_updates
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

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
-- PART 9: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_progress_updates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 10: REPAIR EXISTING DATA
-- ============================================================================

-- Sync emails from auth.users to app_users where missing
UPDATE public.app_users au
SET email = u.email
FROM auth.users u
WHERE au.user_id = u.id
  AND (au.email IS NULL OR au.email = '');

-- ============================================================================
-- PART 11: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.app_users;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_progress_trackers;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_updates;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after the fix to verify)
-- ============================================================================

-- Check all your data is correct
SELECT 
  'app_users check' as test,
  id, 
  user_id, 
  email, 
  role,
  full_name
FROM public.app_users
ORDER BY created_at DESC
LIMIT 10;

-- Check policies are created
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('app_users', 'job_crew_assignments', 'job_progress_trackers')
ORDER BY tablename, policyname;

