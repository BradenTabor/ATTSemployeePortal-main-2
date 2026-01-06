/*
  ============================================================================
  EXPAND app_users ROLE CONSTRAINT
  ============================================================================
  
  This migration expands the role constraint on app_users to include:
  - general_foreman
  - safety_officer
  - foreman
  
  Previous constraint only allowed: employee, admin, manager, mechanic
  New constraint allows all 7 roles used in the application.
  
  ============================================================================
*/

BEGIN;

-- STEP 1: Safety check for invalid roles
DO $$
BEGIN
  RAISE NOTICE 'Checking for invalid roles...';
  
  IF EXISTS (
    SELECT 1 FROM public.app_users 
    WHERE role NOT IN ('employee', 'admin', 'manager', 'mechanic')
  ) THEN
    RAISE WARNING 'Found users with invalid roles - they will need manual cleanup';
  END IF;
END $$;

-- STEP 2: Drop existing constraint
ALTER TABLE public.app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

-- STEP 3: Add new constraint with all 7 roles
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('employee', 'admin', 'manager', 'mechanic', 'general_foreman', 'safety_officer', 'foreman'));

-- STEP 4: Verify constraint was applied
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'app_users_role_check'
  ) THEN
    RAISE NOTICE 'Role constraint successfully updated!';
  ELSE
    RAISE EXCEPTION 'Failed to add role constraint!';
  END IF;
END $$;

COMMIT;


