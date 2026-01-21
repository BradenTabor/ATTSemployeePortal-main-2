-- ============================================================================
-- SEED TEST USERS FOR QA TESTING
-- ============================================================================
-- 
-- This script creates test users in both auth.users and app_users tables.
-- Run this against your test database/branch before running tests.
--
-- IMPORTANT: These users have known passwords for automated testing.
-- NEVER run this script against a production database.
--
-- ============================================================================

-- Create test users in auth.users (requires service role or direct DB access)
-- Note: In Supabase, you typically create auth users via the API or Dashboard.
-- This SQL is for reference; use the Supabase Auth Admin API to create users.

-- ============================================================================
-- OPTION 1: Create app_users entries manually after creating auth users
-- ============================================================================

-- After creating auth users via Supabase Dashboard or API, run this:
-- Replace the UUIDs with the actual user_id values from auth.users

/*
-- Employee test user
INSERT INTO public.app_users (user_id, email, full_name, role)
VALUES (
  'REPLACE_WITH_EMPLOYEE_AUTH_USER_ID',
  'test-employee@atts.test',
  'Test Employee',
  'employee'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Foreman test user
INSERT INTO public.app_users (user_id, email, full_name, role)
VALUES (
  'REPLACE_WITH_FOREMAN_AUTH_USER_ID',
  'test-foreman@atts.test',
  'Test Foreman',
  'foreman'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Mechanic test user
INSERT INTO public.app_users (user_id, email, full_name, role)
VALUES (
  'REPLACE_WITH_MECHANIC_AUTH_USER_ID',
  'test-mechanic@atts.test',
  'Test Mechanic',
  'mechanic'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- General Foreman test user
INSERT INTO public.app_users (user_id, email, full_name, role)
VALUES (
  'REPLACE_WITH_GF_AUTH_USER_ID',
  'test-gf@atts.test',
  'Test General Foreman',
  'general_foreman'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

-- Admin test user
INSERT INTO public.app_users (user_id, email, full_name, role)
VALUES (
  'REPLACE_WITH_ADMIN_AUTH_USER_ID',
  'test-admin@atts.test',
  'Test Admin',
  'admin'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
*/

-- ============================================================================
-- OPTION 2: Using pg_crypto to generate UUIDs (for test databases with direct access)
-- ============================================================================

-- This creates deterministic UUIDs based on email for consistency across test runs
-- Requires the pgcrypto extension

DO $$
DECLARE
  v_employee_id uuid := gen_random_uuid();
  v_foreman_id uuid := gen_random_uuid();
  v_mechanic_id uuid := gen_random_uuid();
  v_gf_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
BEGIN
  -- Note: You still need to create these users in auth.users via Supabase Auth API
  -- This just ensures app_users entries exist for testing RLS policies
  
  RAISE NOTICE 'Test User IDs generated:';
  RAISE NOTICE 'Employee: %', v_employee_id;
  RAISE NOTICE 'Foreman: %', v_foreman_id;
  RAISE NOTICE 'Mechanic: %', v_mechanic_id;
  RAISE NOTICE 'General Foreman: %', v_gf_id;
  RAISE NOTICE 'Admin: %', v_admin_id;
END;
$$;

-- ============================================================================
-- CLEANUP SCRIPT (run to remove test data)
-- ============================================================================

/*
-- Delete test users from app_users
DELETE FROM public.app_users WHERE email LIKE '%@atts.test';

-- Delete test DVIR reports
DELETE FROM public.dvir_reports WHERE truck_number LIKE 'TEST-%';

-- Delete test JSA records
DELETE FROM public.daily_jsa WHERE work_location LIKE '%Test%';

-- Delete test equipment inspections
DELETE FROM public.daily_equipment_inspections WHERE submitted_by LIKE '%Test%';
*/

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Check existing test users
SELECT 
  user_id,
  email,
  full_name,
  role,
  created_at
FROM public.app_users
WHERE email LIKE '%@atts.test'
ORDER BY role;
