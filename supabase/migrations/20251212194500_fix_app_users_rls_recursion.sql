/*
  ============================================================================
  FIX: app_users RLS INFINITE RECURSION
  ============================================================================
  
  This migration fixes the infinite recursion error on app_users table caused by
  RLS policies that query app_users.role to determine admin access.
  
  Problem:
  - Previous policies used: EXISTS (SELECT 1 FROM app_users WHERE ... AND role = 'admin')
  - This creates a loop: policy on app_users checks app_users, which triggers the
    policy again, causing "infinite recursion detected in policy for relation app_users"
  
  Solution:
  - Drop ALL existing RLS policies on app_users
  - Create simple, non-recursive policies that ONLY check user_id = auth.uid()
  - NEVER check app_users.role within app_users policies
  - Admin operations (UPDATE/DELETE) must use service role or bypass RLS
  - Service role has full access through PostgreSQL roles, not RLS policies
  
  Key Rules:
  1. Users can SELECT their own record (required for role fetching in AuthContext)
  2. Users can INSERT their own record (for registration triggers)
  3. NO admin checks within app_users policies (use service role instead)
  4. Service role access is handled at PostgreSQL role level, not RLS
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================
-- Drop every possible policy name that might exist from previous migrations

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

-- ============================================================================
-- STEP 2: ENABLE RLS (should already be enabled, but ensure it)
-- ============================================================================

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ============================================================================

-- Policy 1: Users can SELECT their own record
-- This is CRITICAL for role fetching in AuthContext.tsx
-- Uses simple user_id = auth.uid() check - NO app_users queries
CREATE POLICY "app_users_select_own"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy 2: Users can INSERT their own record
-- Required for registration triggers that auto-create app_users records
-- Uses simple user_id = auth.uid() check - NO app_users queries
CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STEP 4: SERVICE ROLE ACCESS
-- ============================================================================
-- Service role has full access through PostgreSQL role permissions, not RLS.
-- RLS policies only apply to non-superuser roles. The service role (used by
-- Supabase backend) has elevated privileges and bypasses RLS by default.
--
-- Admin operations (UPDATE/DELETE) on app_users should be done through:
-- 1. Service role (bypasses RLS)
-- 2. Or functions with SECURITY DEFINER that bypass RLS
--
-- We do NOT create UPDATE/DELETE policies here to avoid recursion.
-- Admin functions should use service role or SECURITY DEFINER functions.

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
/*
-- Should return policies WITHOUT app_users subqueries in USING clause
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'app_users'
ORDER BY policyname;

-- Test: Can user fetch their own role? (should work)
SELECT role FROM public.app_users WHERE user_id = auth.uid();

-- Test: Verify no recursion - check policy definitions don't contain app_users queries
SELECT policyname, qual::text
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'app_users'
  AND (qual::text LIKE '%app_users%' OR qual::text LIKE '%app_users%');
-- Should return empty result (no policies should query app_users)
*/

