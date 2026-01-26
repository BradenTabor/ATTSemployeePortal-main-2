-- =============================================================================
-- Tree Felling JSA — Single Table (daily_jsa discriminator)
-- =============================================================================
-- Safe backfill: nullable -> update -> NOT NULL + default + CHECK.
-- =============================================================================

-- Step 1: Add jsa_type as nullable
ALTER TABLE public.daily_jsa
  ADD COLUMN IF NOT EXISTS jsa_type TEXT;

-- Step 2: Backfill existing rows
UPDATE public.daily_jsa
  SET jsa_type = 'daily'
  WHERE jsa_type IS NULL;

-- Step 3: NOT NULL, default, check
ALTER TABLE public.daily_jsa
  ALTER COLUMN jsa_type SET NOT NULL,
  ALTER COLUMN jsa_type SET DEFAULT 'daily';

ALTER TABLE public.daily_jsa
  DROP CONSTRAINT IF EXISTS check_jsa_type;

ALTER TABLE public.daily_jsa
  ADD CONSTRAINT check_jsa_type
  CHECK (jsa_type IN ('daily', 'tree_felling'));

-- Step 4: Add tree_felling_data
ALTER TABLE public.daily_jsa
  ADD COLUMN IF NOT EXISTS tree_felling_data JSONB;

-- Step 5: Index
CREATE INDEX IF NOT EXISTS idx_daily_jsa_jsa_type
  ON public.daily_jsa(jsa_type);

COMMENT ON COLUMN public.daily_jsa.jsa_type IS
  'Type of JSA: daily (standard) or tree_felling (specialized tree work).';

COMMENT ON COLUMN public.daily_jsa.tree_felling_data IS
  'Tree felling-specific data (JSONB). Only populated when jsa_type = tree_felling.';
