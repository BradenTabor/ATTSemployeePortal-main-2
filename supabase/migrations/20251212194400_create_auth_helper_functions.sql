/*
  ============================================================================
  AUTH HELPER FUNCTIONS FOR RLS POLICIES
  ============================================================================
  
  This migration creates SECURITY DEFINER functions to safely check user roles
  without causing infinite recursion in RLS policies.
  
  IMPORTANT: These functions MUST be created before any RLS policies that use them.
  They use SECURITY DEFINER to bypass RLS when checking roles, preventing circular
  dependencies.
  
  Usage in RLS policies:
    ✅ CORRECT: USING (public.is_admin())
    ❌ WRONG: USING (EXISTS (SELECT 1 FROM app_users WHERE user_id = auth.uid() AND role = 'admin'))
  
  The wrong pattern causes infinite recursion when used on app_users table itself.
  
  ============================================================================
*/

-- ============================================================================
-- FUNCTION: public.is_admin()
-- ============================================================================
-- Checks if the current authenticated user has the 'admin' role
-- Returns: BOOLEAN (true if admin, false otherwise)
-- Security: SECURITY DEFINER - bypasses RLS to prevent recursion
-- Note: Created in public schema (not auth) because auth schema is protected

CREATE OR REPLACE FUNCTION public.is_admin()
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

COMMENT ON FUNCTION public.is_admin() IS 
  'Returns true if the current authenticated user has the admin role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- ============================================================================
-- FUNCTION: public.is_admin_or_manager()
-- ============================================================================
-- Checks if the current authenticated user has the 'admin' or 'manager' role
-- Returns: BOOLEAN (true if admin or manager, false otherwise)
-- Security: SECURITY DEFINER - bypasses RLS to prevent recursion
-- Note: Created in public schema (not auth) because auth schema is protected

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
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

COMMENT ON FUNCTION public.is_admin_or_manager() IS 
  'Returns true if the current authenticated user has the admin or manager role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- ============================================================================
-- FUNCTION: public.is_mechanic()
-- ============================================================================
-- Checks if the current authenticated user has the 'mechanic' role
-- Returns: BOOLEAN (true if mechanic, false otherwise)
-- Security: SECURITY DEFINER - bypasses RLS to prevent recursion
-- Note: Created in public schema (not auth) because auth schema is protected

CREATE OR REPLACE FUNCTION public.is_mechanic()
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

COMMENT ON FUNCTION public.is_mechanic() IS 
  'Returns true if the current authenticated user has the mechanic role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Allow authenticated users to execute these functions in RLS policies

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mechanic() TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
/*
-- Test: Can function be called?
SELECT public.is_admin();

-- Check function exists
SELECT proname, prosecdef, provolatile 
FROM pg_proc 
WHERE proname IN ('is_admin', 'is_admin_or_manager', 'is_mechanic')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
*/

