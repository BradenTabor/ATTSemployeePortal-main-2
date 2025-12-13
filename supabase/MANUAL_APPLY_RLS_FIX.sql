/*
  ============================================================================
  MANUAL APPLICATION: RLS Infinite Recursion Fix
  ============================================================================
  
  If supabase db push is failing due to migration history conflicts,
  you can apply these migrations directly via Supabase SQL Editor.
  
  Apply in this order:
  1. First run: Helper functions migration (20251212194400)
  2. Second run: app_users fix migration (20251212194500)
  
  ============================================================================
*/

-- ============================================================================
-- PART 1: Helper Functions (from 20251212194400_create_auth_helper_functions.sql)
-- ============================================================================

-- Function: auth.is_admin()
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT role = 'admin' 
    FROM public.app_users 
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION auth.is_admin() IS 
  'Returns true if the current authenticated user has the admin role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Function: auth.is_admin_or_manager()
CREATE OR REPLACE FUNCTION auth.is_admin_or_manager()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT role IN ('admin', 'manager')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION auth.is_admin_or_manager() IS 
  'Returns true if the current authenticated user has the admin or manager role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Function: auth.is_mechanic()
CREATE OR REPLACE FUNCTION auth.is_mechanic()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT role = 'mechanic'
    FROM public.app_users 
    WHERE user_id = auth.uid()
  );
END;
$$;

COMMENT ON FUNCTION auth.is_mechanic() IS 
  'Returns true if the current authenticated user has the mechanic role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_mechanic() TO authenticated;

-- ============================================================================
-- PART 2: Fix app_users RLS Policies (from 20251212194500_fix_app_users_rls_recursion.sql)
-- ============================================================================

-- Drop ALL existing policies
DROP POLICY IF EXISTS "app_users_select_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_select_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_insert_own" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_delete_admin" ON public.app_users;
DROP POLICY IF EXISTS "users_select_own_or_admin" ON public.app_users;
DROP POLICY IF EXISTS "users_insert_own" ON public.app_users;
DROP POLICY IF EXISTS "admins_update_roles" ON public.app_users;
DROP POLICY IF EXISTS "admins_delete_users" ON public.app_users;
DROP POLICY IF EXISTS "Users can read own role" ON public.app_users;
DROP POLICY IF EXISTS "System can insert new users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.app_users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.app_users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.app_users;

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "app_users_select_own"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, verify with:
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename = 'app_users'
-- ORDER BY policyname;

