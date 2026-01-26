/*
  ============================================================================
  SECURITY FIX: app_users INSERT Privilege Escalation (SEC-010)
  ============================================================================
  
  CRITICAL SECURITY FIX: Prevent privilege escalation in app_users INSERT policy.
  
  Problem:
  - Current policy allows authenticated users to INSERT their own record
  - Policy only checks: user_id = auth.uid()
  - Users can set role = 'admin' or 'manager' during INSERT, escalating privileges
  - This allows any user to grant themselves admin access
  
  Attack Vector:
  1. User signs up and gets 'employee' role via trigger
  2. User deletes their app_users record (if possible) or finds gap
  3. User manually INSERTs new record with role = 'admin'
  4. User now has admin privileges
  
  Solution:
  - Modify INSERT policy to enforce role = 'employee' OR role IS NULL (uses default)
  - Prevent users from setting role to 'admin' or 'manager' during INSERT
  - Only service role or SECURITY DEFINER functions can set elevated roles
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: DROP EXISTING VULNERABLE POLICY
-- ============================================================================

DROP POLICY IF EXISTS "app_users_insert_own" ON public.app_users;
DROP POLICY IF EXISTS "System can insert new users" ON public.app_users;

-- ============================================================================
-- STEP 2: CREATE SECURE INSERT POLICY
-- ============================================================================
-- Policy ensures:
-- 1. user_id must match auth.uid() (users can only insert their own record)
-- 2. role must be 'employee' OR NULL (NULL uses table default 'employee')
-- 3. Users CANNOT set role to 'admin' or 'manager' during INSERT

CREATE POLICY "app_users_insert_own"
  ON public.app_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (role = 'employee' OR role IS NULL)
  );

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================
-- After migration, test:
-- 
-- 1. User should be able to INSERT with role = 'employee':
--    INSERT INTO app_users (user_id, role) VALUES (auth.uid(), 'employee');
--    -- Should succeed
--
-- 2. User should be able to INSERT with role = NULL (uses default):
--    INSERT INTO app_users (user_id) VALUES (auth.uid());
--    -- Should succeed, role defaults to 'employee'
--
-- 3. User should NOT be able to INSERT with role = 'admin':
--    INSERT INTO app_users (user_id, role) VALUES (auth.uid(), 'admin');
--    -- Should fail with policy violation
--
-- 4. User should NOT be able to INSERT with role = 'manager':
--    INSERT INTO app_users (user_id, role) VALUES (auth.uid(), 'manager');
--    -- Should fail with policy violation
--
-- 5. Service role should still be able to INSERT with any role:
--    -- Service role bypasses RLS, so this should work
--    -- Admin operations should use service role or SECURITY DEFINER functions

-- ============================================================================
-- NOTES
-- ============================================================================
-- - The trigger handle_new_user() runs as SECURITY DEFINER, so it can still
--   set role = 'employee' (which is allowed by the policy)
-- - Admin role assignments must be done via:
--   1. Service role (bypasses RLS)
--   2. SECURITY DEFINER functions that bypass RLS
--   3. Direct database access by administrators
-- - This fix prevents privilege escalation while maintaining legitimate
--   registration flow through triggers
