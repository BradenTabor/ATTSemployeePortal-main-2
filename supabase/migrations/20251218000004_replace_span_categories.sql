-- Migration: Replace span length categories with single 'general' option
-- This migration:
--   1. Drops the existing CHECK constraint
--   2. Migrates all existing span_length_category values to 'general'
--   3. Adds new CHECK constraint to only allow 'general'
--   4. Sets the column default to 'general'

-- 1. Drop old constraint FIRST (before updating data)
ALTER TABLE public.job_progress_updates
  DROP CONSTRAINT IF EXISTS job_progress_updates_span_length_category_check;

-- 2. Migrate all existing records to 'general'
UPDATE public.job_progress_updates
SET span_length_category = 'general'
WHERE span_length_category IS DISTINCT FROM 'general';

-- 3. Add new constraint with only 'general'
ALTER TABLE public.job_progress_updates
  ADD CONSTRAINT job_progress_updates_span_length_category_check
  CHECK (span_length_category = 'general');

-- 4. Set default value
ALTER TABLE public.job_progress_updates
  ALTER COLUMN span_length_category SET DEFAULT 'general';
