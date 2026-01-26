/*
  ============================================================================
  SECURITY FIX: Equipment Inspections UPDATE Policy Too Permissive (SEC-007)
  ============================================================================
  
  HIGH PRIORITY SECURITY FIX: Fix overly permissive UPDATE policy on 
  daily_equipment_inspections table.
  
  Problem:
  - Current UPDATE policy may directly query app_users table, causing RLS recursion
  - Policy may allow updates to all columns instead of just mechanic fix fields
  - Should use public.is_admin_or_mechanic() helper function instead of direct queries
  
  Solution:
  - Replace direct app_users queries with public.is_admin_or_mechanic() helper
  - Ensure policy only allows updates to mechanic fix fields (mechanic_fixes, 
    mechanic_cost, mechanic_parts_used, last_mechanic_updated_at)
  - Use helper function to avoid RLS recursion issues
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: DROP EXISTING POLICIES (IDEMPOTENCY)
-- ============================================================================

DROP POLICY IF EXISTS "equipment_inspection_fix_update" ON public.daily_equipment_inspections;
DROP POLICY IF EXISTS "equipment_inspections_update" ON public.daily_equipment_inspections;
DROP POLICY IF EXISTS "equipment_update_privileged" ON public.daily_equipment_inspections;

-- ============================================================================
-- STEP 2: ENABLE RLS (ENSURE IT'S ENABLED)
-- ============================================================================

ALTER TABLE public.daily_equipment_inspections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: CREATE SECURE UPDATE POLICY
-- ============================================================================
-- Only admins and mechanics can update equipment inspections
-- Uses public.is_admin_or_mechanic() helper to avoid RLS recursion
-- Policy allows updates to mechanic fix fields only:
--   - mechanic_fixes
--   - mechanic_cost
--   - mechanic_parts_used
--   - last_mechanic_updated_at

CREATE POLICY "equipment_inspection_fix_update"
  ON public.daily_equipment_inspections
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_mechanic())
  WITH CHECK (
    public.is_admin_or_mechanic()
    -- Ensure only mechanic fix fields can be updated
    -- Use JSONB comparison to ensure other fields remain unchanged
    AND (
      SELECT to_jsonb(original) - '{mechanic_fixes,mechanic_cost,mechanic_parts_used,last_mechanic_updated_at}'
      FROM public.daily_equipment_inspections AS original
      WHERE original.id = daily_equipment_inspections.id
    ) =
    to_jsonb(daily_equipment_inspections) - '{mechanic_fixes,mechanic_cost,mechanic_parts_used,last_mechanic_updated_at}'
  );

-- ============================================================================
-- STEP 4: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.daily_equipment_inspections;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After migration, verify:
-- 
-- 1. Admins/mechanics can UPDATE mechanic fix fields:
--    UPDATE daily_equipment_inspections 
--    SET mechanic_fixes = 'Fixed brake issue', last_mechanic_updated_at = NOW()
--    WHERE id = '...';
--    -- Should succeed for admin/mechanic users
--
-- 2. Admins/mechanics cannot UPDATE other fields:
--    UPDATE daily_equipment_inspections 
--    SET equipment_number = 'B999', mechanic_fixes = 'Fixed'
--    WHERE id = '...';
--    -- Should fail (cannot change equipment_number)
--
-- 3. Non-admin/mechanic users cannot UPDATE:
--    UPDATE daily_equipment_inspections 
--    SET mechanic_fixes = 'Fixed'
--    WHERE id = '...';
--    -- Should fail with policy violation
--
-- 4. Policy uses helper function (no recursion):
--    -- Check that policy doesn't directly query app_users
--    SELECT policyname, qual::text
--    FROM pg_policies 
--    WHERE schemaname = 'public' 
--      AND tablename = 'daily_equipment_inspections'
--      AND policyname = 'equipment_inspection_fix_update';
--    -- Should show use of public.is_admin_or_mechanic(), not direct app_users query
