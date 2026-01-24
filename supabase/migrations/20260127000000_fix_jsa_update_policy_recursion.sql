/*
  ============================================================================
  FIX JSA UPDATE POLICY INFINITE RECURSION
  ============================================================================
  Description: Fixes infinite recursion in jsa_update_shared and jsa_update_admin
               policies by using security definer functions to read old values
               without triggering RLS recursion.
  Date: 2026-01-27
  
  Issue: Policies were querying daily_jsa table in WITH CHECK clause, causing
         infinite recursion (error 42P17).
  
  Solution: Create security definer functions to safely read old values.
  ============================================================================
*/

-- ============================================================================
-- STEP 1: Create security definer function to get old user_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_jsa_user_id(jsa_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT user_id FROM public.daily_jsa WHERE id = jsa_id;
$$;

COMMENT ON FUNCTION public.get_jsa_user_id IS 
'Get user_id for a JSA without triggering RLS recursion. Used in UPDATE policies.';

-- ============================================================================
-- STEP 2: Create security definer function to get old shared_with_users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_jsa_shared_users(jsa_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT shared_with_users FROM public.daily_jsa WHERE id = jsa_id;
$$;

COMMENT ON FUNCTION public.get_jsa_shared_users IS 
'Get shared_with_users for a JSA without triggering RLS recursion. Used in UPDATE policies.';

-- ============================================================================
-- STEP 3: Fix jsa_update_own policy (remove recursive query)
-- ============================================================================

DROP POLICY IF EXISTS "jsa_update_own" ON public.daily_jsa;

CREATE POLICY "jsa_update_own" ON public.daily_jsa
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    -- Prevent changing user_id (owner must remain owner)
    -- Use function to avoid recursion
    user_id = public.get_jsa_user_id(daily_jsa.id)
  );

COMMENT ON POLICY "jsa_update_own" ON public.daily_jsa IS 
'Original creator can update all fields including shared_with_users. Prevents changing user_id.';

-- ============================================================================
-- STEP 4: Fix jsa_update_shared policy (remove recursive queries)
-- ============================================================================

DROP POLICY IF EXISTS "jsa_update_shared" ON public.daily_jsa;

CREATE POLICY "jsa_update_shared" ON public.daily_jsa
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be in shared_with_users array
    -- Check current row's shared_with_users (before update)
    shared_with_users IS NOT NULL
    AND shared_with_users @> jsonb_build_array(
      jsonb_build_object('id', (SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    -- Prevent changing user_id
    user_id = public.get_jsa_user_id(daily_jsa.id)
    -- CRITICAL: Prevent changing shared_with_users (immutable for delegated users)
    -- Use function to avoid recursion
    AND shared_with_users = public.get_jsa_shared_users(daily_jsa.id)
  );

COMMENT ON POLICY "jsa_update_shared" ON public.daily_jsa IS 
'Delegated users can update JSA content but cannot modify shared_with_users or user_id. Prevents privilege escalation.';

-- ============================================================================
-- STEP 5: Fix jsa_update_admin policy (remove recursive query)
-- ============================================================================

DROP POLICY IF EXISTS "jsa_update_admin" ON public.daily_jsa;

CREATE POLICY "jsa_update_admin" ON public.daily_jsa
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = (SELECT auth.uid())
      AND app_users.role IN ('admin', 'general_foreman', 'safety_officer')
    )
  )
  WITH CHECK (
    -- Admins can update but should preserve user_id for audit trail
    -- Use function to avoid recursion
    user_id = public.get_jsa_user_id(daily_jsa.id)
  );

COMMENT ON POLICY "jsa_update_admin" ON public.daily_jsa IS 
'Admins and safety officers can update JSAs for compliance oversight. Preserves original user_id.';

-- ============================================================================
-- STEP 6: Verify functions and policies
-- ============================================================================

DO $$
BEGIN
  -- Verify functions exist
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_jsa_user_id' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'SUCCESS: get_jsa_user_id function created';
  ELSE
    RAISE WARNING 'FAILED: get_jsa_user_id function not found';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_jsa_shared_users' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'SUCCESS: get_jsa_shared_users function created';
  ELSE
    RAISE WARNING 'FAILED: get_jsa_shared_users function not found';
  END IF;
  
  -- Verify policies exist
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_jsa' 
    AND policyname = 'jsa_update_own'
  ) THEN
    RAISE NOTICE 'SUCCESS: jsa_update_own policy updated';
  ELSE
    RAISE WARNING 'FAILED: jsa_update_own policy not found';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_jsa' 
    AND policyname = 'jsa_update_shared'
  ) THEN
    RAISE NOTICE 'SUCCESS: jsa_update_shared policy updated';
  ELSE
    RAISE WARNING 'FAILED: jsa_update_shared policy not found';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_jsa' 
    AND policyname = 'jsa_update_admin'
  ) THEN
    RAISE NOTICE 'SUCCESS: jsa_update_admin policy updated';
  ELSE
    RAISE WARNING 'FAILED: jsa_update_admin policy not found';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 
-- Security:
-- - Functions use SECURITY DEFINER to bypass RLS when reading old values
-- - Functions are STABLE to allow optimization
-- - Functions only read, never modify data
--
-- Performance:
-- - Functions are simple SELECT queries, very fast
-- - No recursion risk since they bypass RLS
--
-- Why this works:
-- - SECURITY DEFINER functions run with the privileges of the function creator
-- - They bypass RLS policies, preventing infinite recursion
-- - Still secure because they only read specific columns
-- ============================================================================
