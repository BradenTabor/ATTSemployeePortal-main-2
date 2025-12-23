/*
  ============================================================================
  SCHEMA CONSOLIDATION MIGRATION
  ============================================================================
  
  This migration consolidates and fixes schema issues identified in the
  comprehensive migration audit performed on 2025-12-23.
  
  Fixes Applied:
  1. Consolidates announcements table schema (adds missing columns)
  2. Adds missing `updated_at` columns and auto-update triggers
  3. Adds missing indexes on foreign keys for performance
  4. Fixes SECURITY DEFINER functions to include search_path
  5. Ensures consistent timestamp types (TIMESTAMPTZ)
  
  All operations are idempotent (safe to run multiple times).
  
  ============================================================================
*/

-- ============================================================================
-- SECTION 1: CONSOLIDATE ANNOUNCEMENTS TABLE SCHEMA
-- ============================================================================
-- The announcements table was created by two different migrations with
-- different column sets. This ensures all expected columns exist.

-- Add 'message' column (from second migration) if not exists
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS message text;

-- Add 'author' column (from second migration) if not exists
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS author text;

-- Add 'content' column (from first migration) if not exists
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';

-- Add 'raw_data' column (from first migration) if not exists
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}'::jsonb;

-- Add 'synced_at' column if not exists
ALTER TABLE public.announcements 
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

COMMENT ON TABLE public.announcements IS 
  'Company announcements synced from external sources and displayed on the dashboard. Contains both content (long) and message (short) fields for flexibility.';

-- ============================================================================
-- SECTION 2: CREATE GENERIC updated_at TRIGGER FUNCTION
-- ============================================================================
-- This function can be reused across all tables needing updated_at auto-update

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

COMMENT ON FUNCTION public.update_updated_at_column() IS 
  'Generic trigger function to auto-update the updated_at column on row modification. Reusable across all tables.';

-- ============================================================================
-- SECTION 3: ADD MISSING updated_at COLUMNS AND TRIGGERS
-- ============================================================================

-- 3.1: rto_requests - add updated_at column and trigger
ALTER TABLE public.rto_requests 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trigger_update_rto_requests_updated_at ON public.rto_requests;
CREATE TRIGGER trigger_update_rto_requests_updated_at
  BEFORE UPDATE ON public.rto_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.2: dvir_reports - add updated_at column and trigger
ALTER TABLE public.dvir_reports 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trigger_update_dvir_reports_updated_at ON public.dvir_reports;
CREATE TRIGGER trigger_update_dvir_reports_updated_at
  BEFORE UPDATE ON public.dvir_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.3: daily_equipment_inspections - add updated_at column and trigger
ALTER TABLE public.daily_equipment_inspections 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trigger_update_daily_equipment_inspections_updated_at ON public.daily_equipment_inspections;
CREATE TRIGGER trigger_update_daily_equipment_inspections_updated_at
  BEFORE UPDATE ON public.daily_equipment_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.4: contact_requests - add updated_at column and trigger
ALTER TABLE public.contact_requests 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trigger_update_contact_requests_updated_at ON public.contact_requests;
CREATE TRIGGER trigger_update_contact_requests_updated_at
  BEFORE UPDATE ON public.contact_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.5: job_milestones - add updated_at column and trigger
ALTER TABLE public.job_milestones 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trigger_update_job_milestones_updated_at ON public.job_milestones;
CREATE TRIGGER trigger_update_job_milestones_updated_at
  BEFORE UPDATE ON public.job_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.6: announcements - trigger for updated_at (column already exists)
DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON public.announcements;
CREATE TRIGGER trigger_update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.7: announcement_metadata - create table if not exists, then add trigger
-- This table was defined in the original migration but may not exist in all environments
CREATE TABLE IF NOT EXISTS public.announcement_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_sync timestamptz DEFAULT now(),
  total_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.announcement_metadata IS 
  'Tracks sync status for external announcement sources (e.g., Make.com webhooks).';

-- Enable RLS on announcement_metadata
ALTER TABLE public.announcement_metadata ENABLE ROW LEVEL SECURITY;

-- RLS policies for announcement_metadata (if not exists pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'announcement_metadata' 
    AND policyname = 'metadata_select_authenticated'
  ) THEN
    CREATE POLICY "metadata_select_authenticated"
      ON public.announcement_metadata
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'announcement_metadata' 
    AND policyname = 'metadata_select_anon'
  ) THEN
    CREATE POLICY "metadata_select_anon"
      ON public.announcement_metadata
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_update_announcement_metadata_updated_at ON public.announcement_metadata;
CREATE TRIGGER trigger_update_announcement_metadata_updated_at
  BEFORE UPDATE ON public.announcement_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial metadata record if none exists
INSERT INTO public.announcement_metadata (last_sync, total_count)
SELECT now(), 0
WHERE NOT EXISTS (SELECT 1 FROM public.announcement_metadata);

-- 3.8: app_users - add updated_at column and trigger
ALTER TABLE public.app_users 
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS trigger_update_app_users_updated_at ON public.app_users;
CREATE TRIGGER trigger_update_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SECTION 4: ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================
-- Foreign keys should have indexes for efficient JOIN and DELETE operations

-- 4.1: job_milestones.completed_by (references auth.users)
CREATE INDEX IF NOT EXISTS idx_job_milestones_completed_by 
  ON public.job_milestones(completed_by);

-- 4.2: job_crew_assignments.assigned_by (references auth.users)
CREATE INDEX IF NOT EXISTS idx_job_crew_assignments_assigned_by 
  ON public.job_crew_assignments(assigned_by);

-- 4.3: job_progress_trackers.created_by (references auth.users)
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_created_by 
  ON public.job_progress_trackers(created_by);

-- 4.4: Ensure all user_id foreign keys have indexes
CREATE INDEX IF NOT EXISTS idx_rto_requests_user_id 
  ON public.rto_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_announcements_date 
  ON public.announcements(date DESC);

-- ============================================================================
-- SECTION 5: FIX SECURITY DEFINER FUNCTIONS - ADD search_path
-- ============================================================================
-- Functions with SECURITY DEFINER should set search_path to prevent
-- privilege escalation attacks

-- 5.1: Fix update_job_progress_trackers_updated_at
CREATE OR REPLACE FUNCTION public.update_job_progress_trackers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

COMMENT ON FUNCTION public.update_job_progress_trackers_updated_at() IS 
  'Auto-updates updated_at column on job_progress_trackers table. Uses SET search_path for security.';

-- 5.2: Ensure helper functions have search_path set
-- These should already have it, but let's ensure consistency
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT role = 'admin' 
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'manager')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_mechanic()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT role = 'mechanic'
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;

-- 5.3: Add is_admin_or_mechanic helper for equipment inspections
CREATE OR REPLACE FUNCTION public.is_admin_or_mechanic()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'mechanic')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;

COMMENT ON FUNCTION public.is_admin_or_mechanic() IS 
  'Returns true if the current authenticated user has the admin or mechanic role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mechanic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_mechanic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- ============================================================================
-- SECTION 6: FIX handle_new_user FUNCTION
-- ============================================================================
-- Ensure the trigger function uses correct column names and has search_path

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name text;
  v_dl_number text;
  v_dl_class text;
  v_dl_exp text;
BEGIN
  -- Extract metadata fields from raw_user_meta_data
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
  v_dl_number := new.raw_user_meta_data->>'drivers_license_number';
  v_dl_class  := new.raw_user_meta_data->>'drivers_license_class';
  v_dl_exp    := new.raw_user_meta_data->>'drivers_license_expiration';

  -- Upsert into app_users using CORRECT column (user_id, not id)
  INSERT INTO public.app_users (
    user_id,
    email,
    full_name,
    drivers_license_number,
    drivers_license_class,
    drivers_license_expiration,
    role
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_dl_number,
    v_dl_class,
    v_dl_exp,
    'employee'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.app_users.full_name),
    drivers_license_number = COALESCE(EXCLUDED.drivers_license_number, public.app_users.drivers_license_number),
    drivers_license_class = COALESCE(EXCLUDED.drivers_license_class, public.app_users.drivers_license_class),
    drivers_license_expiration = COALESCE(EXCLUDED.drivers_license_expiration, public.app_users.drivers_license_expiration);
    -- NOTE: Role is NOT updated on conflict to preserve admin/mechanic roles

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Trigger function that creates/updates app_users record when a new auth.users record is created. Uses user_id column correctly.';

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SECTION 7: UPDATE get_job_progress FUNCTION WITH search_path
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_job_progress(p_job_id UUID)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_today DATE := CURRENT_DATE;
  v_total_days INTEGER;
  v_elapsed_days INTEGER;
  v_percentage INTEGER;
  v_status TEXT;
  v_days_exceeded INTEGER;
  v_days_remaining INTEGER;
BEGIN
  SELECT start_date, end_date INTO v_start_date, v_end_date
  FROM public.job_progress_trackers
  WHERE id = p_job_id;
  
  IF v_start_date IS NULL THEN
    RETURN json_build_object(
      'percentage', 0,
      'status', 'not_found',
      'daysExceeded', 0,
      'daysRemaining', 0,
      'totalDays', 0,
      'elapsedDays', 0
    );
  END IF;
  
  v_total_days := GREATEST(1, (v_end_date - v_start_date) + 1);
  
  IF v_today < v_start_date THEN
    RETURN json_build_object(
      'percentage', 0,
      'status', 'not_started',
      'daysExceeded', 0,
      'daysRemaining', (v_start_date - v_today),
      'totalDays', v_total_days,
      'elapsedDays', 0
    );
  END IF;
  
  IF v_today > v_end_date THEN
    v_days_exceeded := (v_today - v_end_date);
    RETURN json_build_object(
      'percentage', 100,
      'status', 'exceeded',
      'daysExceeded', v_days_exceeded,
      'daysRemaining', 0,
      'totalDays', v_total_days,
      'elapsedDays', v_total_days + v_days_exceeded
    );
  END IF;
  
  IF v_today = v_end_date THEN
    RETURN json_build_object(
      'percentage', 100,
      'status', 'completed',
      'daysExceeded', 0,
      'daysRemaining', 0,
      'totalDays', v_total_days,
      'elapsedDays', v_total_days
    );
  END IF;
  
  v_elapsed_days := (v_today - v_start_date) + 1;
  v_days_remaining := (v_end_date - v_today);
  v_percentage := LEAST(100, GREATEST(0, ROUND((v_elapsed_days::FLOAT / v_total_days::FLOAT) * 100)));
  
  RETURN json_build_object(
    'percentage', v_percentage,
    'status', 'in_progress',
    'daysExceeded', 0,
    'daysRemaining', v_days_remaining,
    'totalDays', v_total_days,
    'elapsedDays', v_elapsed_days
  );
END;
$$ LANGUAGE plpgsql 
STABLE
SET search_path = public;

COMMENT ON FUNCTION public.get_job_progress IS 
  'Calculates job progress based on dates. Returns JSON with percentage, status, and day counts.';

-- ============================================================================
-- SECTION 8: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.announcements;
ANALYZE public.announcement_metadata;
ANALYZE public.app_users;
ANALYZE public.rto_requests;
ANALYZE public.dvir_reports;
ANALYZE public.daily_equipment_inspections;
ANALYZE public.contact_requests;
ANALYZE public.job_milestones;
ANALYZE public.job_progress_trackers;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_progress_updates;

-- ============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- ============================================================================
/*
-- Check all tables have updated_at columns
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'updated_at'
ORDER BY table_name;

-- Check all triggers are created
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%updated_at%'
ORDER BY event_object_table;

-- Check indexes exist
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check helper functions
SELECT 
  proname,
  prosecdef,
  proconfig
FROM pg_proc
WHERE proname IN ('is_admin', 'is_admin_or_manager', 'is_mechanic', 'is_admin_or_mechanic')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
*/

