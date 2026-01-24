-- Rollback NOT NULL constraint on observer_signatures
-- The 400 error suggests the NOT NULL constraint might be causing issues

ALTER TABLE public.daily_jsa 
ALTER COLUMN observer_signatures DROP NOT NULL;

-- Keep the default for new records
ALTER TABLE public.daily_jsa 
ALTER COLUMN observer_signatures SET DEFAULT '[]'::jsonb;

-- Verify change
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'daily_jsa' 
AND column_name = 'observer_signatures';
