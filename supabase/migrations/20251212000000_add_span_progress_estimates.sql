-- Migration: Add estimated span/feet fields for span-based job progress tracking
-- Notes:
--  - Adds estimated_total_spans, estimated_total_feet, and span_progress_metric columns
--  - These allow admins to define job completion targets for span-based jobs
--  - Progress can be tracked by # of spans or by total feet

-- 1. Add new columns to job_progress_trackers
ALTER TABLE public.job_progress_trackers
  ADD COLUMN IF NOT EXISTS estimated_total_spans INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_total_feet NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS span_progress_metric TEXT DEFAULT 'spans'
    CHECK (span_progress_metric IN ('spans', 'feet'));

-- 2. Add comments for documentation
COMMENT ON COLUMN public.job_progress_trackers.estimated_total_spans IS 'Estimated total number of spans for span-based job tracking';
COMMENT ON COLUMN public.job_progress_trackers.estimated_total_feet IS 'Estimated total feet for span-based job tracking';
COMMENT ON COLUMN public.job_progress_trackers.span_progress_metric IS 'Which metric to use for progress calculation: spans or feet';

-- 3. Backfill existing span-based jobs with sensible defaults (optional)
-- UPDATE public.job_progress_trackers
-- SET span_progress_metric = 'spans'
-- WHERE tracking_type = 'job_progress' AND span_progress_metric IS NULL;

-- 4. Verification helper
-- SELECT id, job_name, tracking_type, estimated_total_spans, estimated_total_feet, span_progress_metric
-- FROM public.job_progress_trackers
-- WHERE tracking_type = 'job_progress';

-- 5. Rollback instructions (manual, if needed)
-- ALTER TABLE public.job_progress_trackers
--   DROP COLUMN IF EXISTS estimated_total_spans,
--   DROP COLUMN IF EXISTS estimated_total_feet,
--   DROP COLUMN IF EXISTS span_progress_metric;

