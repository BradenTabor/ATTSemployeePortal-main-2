-- Migration: Add dual tracking support and span-based progress updates
-- Notes:
--  - Adds tracking_type + circuit columns to job_progress_trackers
--  - Backfills existing data to keep timeline mode intact
--  - Introduces job_progress_updates table with RLS + realtime

-- 1. Add new columns to existing jobs table (nullable first for backfill)
ALTER TABLE public.job_progress_trackers
  ADD COLUMN IF NOT EXISTS tracking_type TEXT DEFAULT 'timeline'
    CHECK (tracking_type IN ('timeline', 'job_progress')),
  ADD COLUMN IF NOT EXISTS circuit TEXT;

-- 2. Semantic note: circuit supersedes job_location over time
COMMENT ON COLUMN public.job_progress_trackers.job_location IS 'DEPRECATED: Use circuit column instead';
COMMENT ON COLUMN public.job_progress_trackers.circuit IS 'Circuit identifier for the job';

-- 3. Backfill existing jobs to preserve timeline mode and location data
UPDATE public.job_progress_trackers
SET
  tracking_type = 'timeline',
  circuit = CASE
    WHEN job_location IS NOT NULL AND job_location <> '' THEN job_location
    ELSE 'UNKNOWN_' || SUBSTRING(id::text, 1, 8)
  END
WHERE tracking_type IS NULL;

-- 4. Harden constraints after backfill
ALTER TABLE public.job_progress_trackers
  ALTER COLUMN tracking_type SET DEFAULT 'timeline',
  ALTER COLUMN tracking_type SET NOT NULL;

-- 5. Create job_progress_updates table for span-based tracking
CREATE TABLE IF NOT EXISTS public.job_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.job_progress_trackers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- User-submitted data
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  circuit TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Span completion data
  spans_completed INTEGER NOT NULL CHECK (spans_completed > 0),
  span_length_feet NUMERIC(10, 2) NOT NULL CHECK (span_length_feet > 0),
  span_length_category TEXT NOT NULL CHECK (span_length_category IN
    ('urban_suburban', 'rural', 'transmission', 'custom')),

  -- Work details
  equipment TEXT NOT NULL CHECK (equipment IN ('jerraff', 'bucket', 'mulcher')),
  job_title TEXT NOT NULL,

  -- Calculated field
  total_feet_completed NUMERIC(12, 2) GENERATED ALWAYS AS (spans_completed * span_length_feet) STORED,

  notes TEXT
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_progress_updates_job_id ON public.job_progress_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_progress_updates_user_id ON public.job_progress_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_job_progress_updates_date ON public.job_progress_updates(date);
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_tracking_type ON public.job_progress_trackers(tracking_type);
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_circuit ON public.job_progress_trackers(circuit);

-- 7. RLS Policies
ALTER TABLE public.job_progress_updates ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to job_progress_updates"
  ON public.job_progress_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

-- Users can manage their own updates for jobs they're assigned to
CREATE POLICY "Users can manage their own progress updates"
  ON public.job_progress_updates FOR ALL
  USING (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.job_crew_assignments
      WHERE job_crew_assignments.job_id = job_progress_updates.job_id
        AND job_crew_assignments.user_id = auth.uid()
    )
  );

-- 8. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_progress_updates;

-- 9. Verification helper
-- SELECT tracking_type, COUNT(*) FROM public.job_progress_trackers GROUP BY tracking_type;

-- 10. Rollback instructions (manual, if needed)
-- ALTER TABLE public.job_progress_trackers
--   DROP COLUMN IF EXISTS tracking_type,
--   DROP COLUMN IF EXISTS circuit;
-- DROP TABLE IF EXISTS public.job_progress_updates CASCADE;

