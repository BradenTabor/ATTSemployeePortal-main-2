/*
  ============================================================================
  ADD USER DELEGATION TO DAILY_JSA
  ============================================================================
  Description: Allows JSA submitters to delegate view/edit access to other users.
               Only the original creator can modify sharing (prevents privilege escalation).
  Date: 2026-01-26
  
  Security: Split UPDATE policies ensure delegated users can edit content but NOT sharing.
  Data Structure: Store user objects (not just IDs) to prevent N+1 queries and preserve data.
  
  Changes:
  1. Add shared_with_users JSONB column (stores user objects with display info)
  2. Add GIN index for efficient JSONB queries
  3. Update SELECT policy to include shared users
  4. Split UPDATE policies (owner vs delegated users)
  ============================================================================
*/

-- ============================================================================
-- STEP 1: Add shared_with_users column
-- ============================================================================

ALTER TABLE public.daily_jsa 
ADD COLUMN IF NOT EXISTS shared_with_users JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.daily_jsa.shared_with_users IS 
'Array of user objects who have delegated access to view/edit this JSA: [{id: uuid, email: string, full_name: string, role: string, added_at: timestamp, added_by: uuid}]. Only the original creator (user_id) can modify this field.';

-- ============================================================================
-- STEP 2: Add GIN index for JSONB queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_daily_jsa_shared_with_users 
ON public.daily_jsa USING GIN (shared_with_users);

-- ============================================================================
-- STEP 3: Update existing NULL values to empty array
-- ============================================================================

UPDATE public.daily_jsa 
SET shared_with_users = '[]'::jsonb 
WHERE shared_with_users IS NULL;

-- ============================================================================
-- STEP 4: Update SELECT policy to include shared users
-- ============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "jsa_select" ON public.daily_jsa;

-- Create new SELECT policy that includes shared users
CREATE POLICY "jsa_select" ON public.daily_jsa
  FOR SELECT
  TO authenticated
  USING (
    -- Owner can view
    user_id = (SELECT auth.uid())
    -- Shared users can view (check if their ID exists in shared_with_users array)
    OR (
      shared_with_users IS NOT NULL
      AND shared_with_users @> jsonb_build_array(
        jsonb_build_object('id', (SELECT auth.uid())::text)
      )
    )
    -- Supervisors can view all
    OR EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = (SELECT auth.uid())
      AND app_users.role IN ('admin', 'supervisor', 'foreman', 'general_foreman', 'safety_officer')
    )
  );

COMMENT ON POLICY "jsa_select" ON public.daily_jsa IS 
'Users can view their own JSAs, JSAs shared with them, or all JSAs if they are supervisors.';

-- ============================================================================
-- STEP 5: Create split UPDATE policies (CRITICAL SECURITY FIX)
-- ============================================================================

-- Drop any existing UPDATE policies
DROP POLICY IF EXISTS "jsa_update_own" ON public.daily_jsa;
DROP POLICY IF EXISTS "jsa_update_shared" ON public.daily_jsa;
DROP POLICY IF EXISTS "jsa_update_admin" ON public.daily_jsa;

-- Policy 1: Owner can update everything including sharing
CREATE POLICY "jsa_update_own" ON public.daily_jsa
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    -- Prevent changing user_id (owner must remain owner)
    user_id = (SELECT user_id FROM public.daily_jsa WHERE id = daily_jsa.id)
  );

COMMENT ON POLICY "jsa_update_own" ON public.daily_jsa IS 
'Original creator can update all fields including shared_with_users. Prevents changing user_id.';

-- Policy 2: Delegated users can update content but NOT sharing
CREATE POLICY "jsa_update_shared" ON public.daily_jsa
  FOR UPDATE
  TO authenticated
  USING (
    -- User must be in shared_with_users array
    shared_with_users IS NOT NULL
    AND shared_with_users @> jsonb_build_array(
      jsonb_build_object('id', (SELECT auth.uid())::text)
    )
  )
  WITH CHECK (
    -- Prevent changing user_id
    user_id = (SELECT user_id FROM public.daily_jsa WHERE id = daily_jsa.id)
    -- CRITICAL: Prevent changing shared_with_users (immutable for delegated users)
    AND shared_with_users = (
      SELECT shared_with_users 
      FROM public.daily_jsa 
      WHERE id = daily_jsa.id
    )
  );

COMMENT ON POLICY "jsa_update_shared" ON public.daily_jsa IS 
'Delegated users can update JSA content but cannot modify shared_with_users or user_id. Prevents privilege escalation.';

-- Policy 3: Admins/supervisors can update (for compliance/oversight)
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
    user_id = (SELECT user_id FROM public.daily_jsa WHERE id = daily_jsa.id)
  );

COMMENT ON POLICY "jsa_update_admin" ON public.daily_jsa IS 
'Admins and safety officers can update JSAs for compliance oversight. Preserves original user_id.';

-- ============================================================================
-- STEP 6: Verify column and policies
-- ============================================================================

DO $$
BEGIN
  -- Verify column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_jsa' 
    AND column_name = 'shared_with_users'
  ) THEN
    RAISE NOTICE 'SUCCESS: shared_with_users column added to daily_jsa table';
  ELSE
    RAISE WARNING 'FAILED: shared_with_users column not found in daily_jsa table';
  END IF;

  -- Verify index exists
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'daily_jsa' 
    AND indexname = 'idx_daily_jsa_shared_with_users'
  ) THEN
    RAISE NOTICE 'SUCCESS: GIN index created on shared_with_users';
  ELSE
    RAISE WARNING 'FAILED: GIN index not found';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 
-- Security:
-- - Only original creator (user_id) can modify shared_with_users
-- - Delegated users can edit JSA content but cannot change sharing
-- - This prevents privilege escalation attacks
--
-- Data Structure:
-- - Store user objects: {id, email, full_name, role, added_at, added_by}
-- - Preserves display info even if user is deleted
-- - Avoids N+1 queries when displaying shared users
--
-- Performance:
-- - GIN index enables fast JSONB array queries
-- - Use @> operator for efficient "contains" checks
--
-- Backward compatibility:
-- - Default value is empty array '[]'::jsonb
-- - Existing records updated to empty array
-- ============================================================================
