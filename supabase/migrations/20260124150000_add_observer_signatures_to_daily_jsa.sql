-- Migration: Add observer_signatures to daily_jsa table
-- Created: 2026-01-24
-- Description: Allows multiple observers to sign JSA forms for compliance tracking
-- Pattern: JSONB array of signature objects for flexible multi-signer support

-- ============================================================================
-- STEP 1: Add observer_signatures column
-- ============================================================================

ALTER TABLE public.daily_jsa 
ADD COLUMN IF NOT EXISTS observer_signatures JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.daily_jsa.observer_signatures IS 
'Array of observer signatures: [{name: string, signature_data: string, timestamp: string, role?: string}]. Used for crew leads, foremen, and safety officers to co-sign JSAs for compliance tracking and multi-level approval workflows.';

-- ============================================================================
-- STEP 2: Optional GIN index for JSONB queries (future analytics)
-- ============================================================================

-- Uncomment if you need to query observer_signatures frequently
-- CREATE INDEX IF NOT EXISTS idx_daily_jsa_observer_signatures 
-- ON public.daily_jsa USING gin (observer_signatures);

-- ============================================================================
-- STEP 3: Verify column exists
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_jsa' 
    AND column_name = 'observer_signatures'
  ) THEN
    RAISE NOTICE 'SUCCESS: observer_signatures column added to daily_jsa table';
  ELSE
    RAISE WARNING 'FAILED: observer_signatures column not found in daily_jsa table';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================

-- Backward compatibility: 
-- - Default value is empty array '[]'::jsonb
-- - Existing JSA records will have empty array (not NULL)
-- - Forms work without observer signatures (optional feature)

-- Example observer signature structure:
-- {
--   "name": "John Doe",
--   "signature_data": "data:image/png;base64,iVBORw0KGgo...",
--   "timestamp": "2026-01-24T15:30:00.000Z",
--   "role": "Foreman"
-- }

-- Query examples:
-- 1. Find JSAs with observer signatures:
--    SELECT * FROM daily_jsa WHERE jsonb_array_length(observer_signatures) > 0;
--
-- 2. Find JSAs signed by specific person:
--    SELECT * FROM daily_jsa WHERE observer_signatures @> '[{"name": "John Doe"}]'::jsonb;
--
-- 3. Count total observers across all JSAs:
--    SELECT SUM(jsonb_array_length(observer_signatures)) FROM daily_jsa;
