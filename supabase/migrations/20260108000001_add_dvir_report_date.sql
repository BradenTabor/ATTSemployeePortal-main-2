/*
  ============================================================================
  ADD report_date COLUMN TO dvir_reports
  ============================================================================
  
  Adds a report_date column to dvir_reports for efficient compliance queries.
  
  Why this is needed:
  - The compliance checker needs to query DVIRs by date
  - Using created_at with timezone conversion is slow and DST-sensitive
  - A dedicated date column enables efficient index scans
  
  This migration:
  1. Adds report_date column if it doesn't exist
  2. Backfills existing rows from created_at (America/Chicago)
  3. Creates an index on report_date
  4. Adds a trigger to auto-set report_date on new inserts
  
  All operations are idempotent (safe to run multiple times).
  ============================================================================
*/

-- =============================================================================
-- STEP 1: Add report_date column
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'dvir_reports' 
      AND column_name = 'report_date'
  ) THEN
    ALTER TABLE public.dvir_reports 
    ADD COLUMN report_date date;
    
    RAISE NOTICE 'Added report_date column to dvir_reports';
  ELSE
    RAISE NOTICE 'report_date column already exists in dvir_reports';
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.dvir_reports.report_date IS 
  'The date of the DVIR report in America/Chicago timezone. Used for compliance queries.';

-- =============================================================================
-- STEP 2: Backfill existing rows
-- =============================================================================
-- Convert created_at to America/Chicago date for all rows where report_date is null

UPDATE public.dvir_reports
SET report_date = (created_at AT TIME ZONE 'America/Chicago')::date
WHERE report_date IS NULL 
  AND created_at IS NOT NULL;

-- Log how many rows were updated
DO $$
DECLARE
  updated_count integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.dvir_reports
  WHERE report_date IS NOT NULL;
  
  RAISE NOTICE 'Backfilled report_date for % rows', updated_count;
END $$;

-- =============================================================================
-- STEP 3: Create index on report_date
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_dvir_reports_report_date 
  ON public.dvir_reports(report_date DESC);

-- Composite index for compliance queries (report_date + created_at for cutoff)
CREATE INDEX IF NOT EXISTS idx_dvir_reports_report_date_created_at 
  ON public.dvir_reports(report_date, created_at);

-- =============================================================================
-- STEP 4: Create trigger function to auto-set report_date
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_dvir_report_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If report_date is not provided, derive it from created_at
  IF NEW.report_date IS NULL THEN
    NEW.report_date := (NEW.created_at AT TIME ZONE 'America/Chicago')::date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.set_dvir_report_date() IS 
  'Auto-sets report_date from created_at in America/Chicago timezone if not provided.';

-- =============================================================================
-- STEP 5: Create trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_set_dvir_report_date ON public.dvir_reports;

CREATE TRIGGER trigger_set_dvir_report_date
  BEFORE INSERT ON public.dvir_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_dvir_report_date();

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
  -- Verify column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'dvir_reports' 
      AND column_name = 'report_date'
  ) THEN
    RAISE EXCEPTION 'report_date column was not created';
  END IF;
  
  -- Verify index exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'dvir_reports' 
      AND indexname = 'idx_dvir_reports_report_date'
  ) THEN
    RAISE EXCEPTION 'report_date index was not created';
  END IF;
  
  -- Verify trigger exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_set_dvir_report_date'
  ) THEN
    RAISE EXCEPTION 'report_date trigger was not created';
  END IF;
  
  RAISE NOTICE 'dvir_reports report_date migration completed successfully!';
END $$;

