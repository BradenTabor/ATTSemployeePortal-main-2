/*
  ============================================================================
  SECURITY FIX: Announcements Table Missing UPDATE/DELETE Policies (SEC-002)
  ============================================================================
  
  HIGH PRIORITY SECURITY FIX: Ensure announcements table has proper UPDATE/DELETE
  policies to prevent unauthorized modifications.
  
  Problem:
  - Announcements table may be missing UPDATE/DELETE policies
  - Without proper policies, unauthorized users could modify or delete announcements
  - Existing policies may have been dropped or not applied correctly
  
  Solution:
  - Ensure UPDATE policy exists for admins only (using public.is_admin() helper)
  - Ensure DELETE policy exists for admins only (using public.is_admin() helper)
  - Policies use helper function to avoid RLS recursion issues
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES (IDEMPOTENCY)
-- ============================================================================

DROP POLICY IF EXISTS "announcements_update_admin" ON public.announcements;
DROP POLICY IF EXISTS "announcements_delete_admin" ON public.announcements;
DROP POLICY IF EXISTS "announcements_update" ON public.announcements;
DROP POLICY IF EXISTS "announcements_delete" ON public.announcements;

-- ============================================================================
-- STEP 2: ENABLE RLS (ENSURE IT'S ENABLED)
-- ============================================================================

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE SECURE UPDATE POLICY
-- ============================================================================
-- Only admins can update announcements
-- Uses public.is_admin() helper function to avoid RLS recursion

CREATE POLICY "announcements_update_admin"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- STEP 4: CREATE SECURE DELETE POLICY
-- ============================================================================
-- Only admins can delete announcements
-- Uses public.is_admin() helper function to avoid RLS recursion

CREATE POLICY "announcements_delete_admin"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 5: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.announcements;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After migration, verify:
-- 
-- 1. Admins can UPDATE announcements:
--    UPDATE announcements SET title = 'Test' WHERE id = '...';
--    -- Should succeed for admin users
--
-- 2. Non-admins cannot UPDATE announcements:
--    UPDATE announcements SET title = 'Test' WHERE id = '...';
--    -- Should fail with policy violation for non-admin users
--
-- 3. Admins can DELETE announcements:
--    DELETE FROM announcements WHERE id = '...';
--    -- Should succeed for admin users
--
-- 4. Non-admins cannot DELETE announcements:
--    DELETE FROM announcements WHERE id = '...';
--    -- Should fail with policy violation for non-admin users
