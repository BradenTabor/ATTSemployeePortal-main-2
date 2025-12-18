/*
  ============================================================================
  OPTIMIZE RTO_REQUESTS TABLE: ADD user_id AND FIX RLS POLICIES
  ============================================================================
  
  This migration addresses performance issues in rto_requests:
  
  1. ADDS user_id column (UUID referencing auth.users)
  2. MIGRATES data by looking up user_id from email via auth.users
  3. UPDATES RLS policies to use indexed user_id instead of JWT email extraction
  4. ADDS proper index on user_id
  
  The previous policy used: email = auth.jwt() ->> 'email'
  This forces sequential scans because:
  - JWT extraction is computed per row
  - No index can be used on the result
  
  New policy uses: user_id = auth.uid()
  This is efficient because:
  - auth.uid() is evaluated once
  - user_id column can be indexed
  
  ============================================================================
*/

-- Ensure idempotency: drop policies if they already exist
DROP POLICY IF EXISTS "Users can view own requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can insert time off requests" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_select_admin" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_delete_admin" ON public.rto_requests;

-- ============================================================================
-- STEP 1: ADD user_id COLUMN
-- ============================================================================
-- Add column as nullable first to allow migration

ALTER TABLE public.rto_requests 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 2: MIGRATE EXISTING DATA
-- ============================================================================
-- Populate user_id by looking up email in auth.users
-- This is a one-time migration; new records should include user_id

UPDATE public.rto_requests rto
SET user_id = au.id
FROM auth.users au
WHERE rto.email = au.email
  AND rto.user_id IS NULL;

-- ============================================================================
-- STEP 3: ADD INDEX ON user_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rto_requests_user_id 
  ON public.rto_requests(user_id);

-- ============================================================================
-- STEP 4: DROP OLD INEFFICIENT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can insert time off requests" ON public.rto_requests;

-- Also drop any policies from consolidation migration that may exist
DROP POLICY IF EXISTS "rto_select_admin" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_insert_authenticated" ON public.rto_requests;
DROP POLICY IF EXISTS "rto_update_admin" ON public.rto_requests;

-- ============================================================================
-- STEP 5: CREATE OPTIMIZED RLS POLICIES
-- ============================================================================

-- Policy 1: Users can view their own requests (using indexed user_id)
CREATE POLICY "rto_select_own"
  ON public.rto_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Policy 2: Admins can view all requests
CREATE POLICY "rto_select_admin"
  ON public.rto_requests
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Policy 3: Authenticated users can insert their own requests
-- Requires user_id to match the authenticated user
CREATE POLICY "rto_insert_own"
  ON public.rto_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy 4: Admins can update request status
CREATE POLICY "rto_update_admin"
  ON public.rto_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Policy 5: Admins can delete requests
CREATE POLICY "rto_delete_admin"
  ON public.rto_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- STEP 6: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.rto_requests;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
/*
-- Check that user_id was populated
SELECT 
  COUNT(*) as total,
  COUNT(user_id) as with_user_id,
  COUNT(*) - COUNT(user_id) as missing_user_id
FROM public.rto_requests;

-- Check policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'rto_requests'
ORDER BY policyname;

-- Test as regular user (should only see own requests)
-- SELECT * FROM rto_requests LIMIT 5;
*/

-- ============================================================================
-- NOTE: Application Code Update Required
-- ============================================================================
-- The RequestTimeOff.tsx form submission must be updated to include user_id:
--
-- Before:
--   { full_name, email, start_date, end_date, reason, notes }
--
-- After:
--   { full_name, email, start_date, end_date, reason, notes, user_id: user.id }
--
-- See src/pages/RequestTimeOff.tsx
-- ============================================================================
