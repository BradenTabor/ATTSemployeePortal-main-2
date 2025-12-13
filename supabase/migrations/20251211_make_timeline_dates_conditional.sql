-- Make start_date/end_date optional for span-based tracking, but required for timeline

-- Drop NOT NULL so span-based jobs can omit dates
ALTER TABLE public.job_progress_trackers
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;

-- Enforce that timeline jobs still provide both dates
ALTER TABLE public.job_progress_trackers
  DROP CONSTRAINT IF EXISTS job_progress_dates_required;

ALTER TABLE public.job_progress_trackers
  ADD CONSTRAINT job_progress_dates_required
    CHECK (
      tracking_type = 'job_progress'
      OR (start_date IS NOT NULL AND end_date IS NOT NULL)
    );

-- Optional: ensure tracking_type default set
ALTER TABLE public.job_progress_trackers
  ALTER COLUMN tracking_type SET DEFAULT 'timeline';


