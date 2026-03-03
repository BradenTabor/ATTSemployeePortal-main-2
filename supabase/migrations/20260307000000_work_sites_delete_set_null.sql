-- =============================================================================
-- Migration: Allow work site deletion by setting job_progress_trackers FK to SET NULL
-- Description: job_progress_trackers.work_site_id previously had no ON DELETE,
--              so deleting a work site failed when any job was linked. Align
--              with risk_score_history and safety_incidents (ON DELETE SET NULL).
-- =============================================================================

-- Drop the default RESTRICT FK and re-add with ON DELETE SET NULL
ALTER TABLE public.job_progress_trackers
  DROP CONSTRAINT IF EXISTS job_progress_trackers_work_site_id_fkey;

ALTER TABLE public.job_progress_trackers
  ADD CONSTRAINT job_progress_trackers_work_site_id_fkey
  FOREIGN KEY (work_site_id)
  REFERENCES public.work_sites(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.job_progress_trackers.work_site_id IS 'Link to work_sites for GPS-based weather forecasting; cleared when site is deleted';
