-- ============================================================================
-- Job Grouping/Stacking Feature
-- ============================================================================
-- Adds a job_group_id column to allow admins to visually group related jobs
-- Jobs with the same job_group_id are displayed as stacked cards in the UI
-- This is purely organizational - no job data is merged or modified
-- ============================================================================

-- Add job_group_id column for visual grouping
ALTER TABLE public.job_progress_trackers 
  ADD COLUMN IF NOT EXISTS job_group_id UUID DEFAULT NULL;

-- Add index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_group 
  ON public.job_progress_trackers(job_group_id) 
  WHERE job_group_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.job_progress_trackers.job_group_id IS 
  'UUID linking related jobs for visual stacking in the UI. Jobs with the same group_id display as stacked cards.';

