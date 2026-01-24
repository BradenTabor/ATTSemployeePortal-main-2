-- Fix: Ensure observer_signatures column exists and has proper default for ALL records
-- This handles any edge cases where the column wasn't added properly

-- First, ensure the column exists with proper type
DO $$ 
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_jsa' 
    AND column_name = 'observer_signatures'
  ) THEN
    ALTER TABLE public.daily_jsa 
    ADD COLUMN observer_signatures JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Update any NULL values to empty array
UPDATE public.daily_jsa 
SET observer_signatures = '[]'::jsonb 
WHERE observer_signatures IS NULL;

-- Ensure default is set for future inserts
ALTER TABLE public.daily_jsa 
ALTER COLUMN observer_signatures SET DEFAULT '[]'::jsonb;

-- Ensure the column is NOT NULL now that we've populated it
ALTER TABLE public.daily_jsa 
ALTER COLUMN observer_signatures SET NOT NULL;

-- Verify the fix
DO $$
DECLARE
  total_count INTEGER;
  with_column_count INTEGER;
  with_signatures_count INTEGER;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(observer_signatures),
    SUM(CASE WHEN jsonb_array_length(observer_signatures) > 0 THEN 1 ELSE 0 END)
  INTO total_count, with_column_count, with_signatures_count
  FROM public.daily_jsa;
  
  RAISE NOTICE 'observer_signatures fix complete: % total records, % with column, % with signatures',
    total_count, with_column_count, with_signatures_count;
END $$;
