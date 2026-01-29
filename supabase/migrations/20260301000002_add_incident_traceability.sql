/*
  Incident Traceability (P0 — Compliance Engine)
  Add job_id, crew_id, supervisor_id and corrective_actions_* to safety_incidents
  for insurer/regulator traceability (every incident traceable to job, crew, supervisor).
*/

-- =============================================================================
-- ADD COLUMNS to safety_incidents
-- =============================================================================
ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.job_progress_trackers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrective_actions_taken text,
  ADD COLUMN IF NOT EXISTS corrective_actions_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrective_actions_at timestamptz;

COMMENT ON COLUMN public.safety_incidents.job_id IS
  'Job (job_progress_trackers) where incident occurred; for incident-to-job traceability.';
COMMENT ON COLUMN public.safety_incidents.crew_id IS
  'Crew where incident occurred; for incident-to-crew traceability.';
COMMENT ON COLUMN public.safety_incidents.supervisor_id IS
  'Supervisor responsible for job/crew at time of incident; for defensibility.';
COMMENT ON COLUMN public.safety_incidents.corrective_actions_taken IS
  'Description of corrective actions taken; for insurer loss control.';
COMMENT ON COLUMN public.safety_incidents.corrective_actions_by IS
  'User who recorded corrective actions.';
COMMENT ON COLUMN public.safety_incidents.corrective_actions_at IS
  'When corrective actions were recorded.';

CREATE INDEX IF NOT EXISTS idx_safety_incidents_job_id
  ON public.safety_incidents(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_safety_incidents_crew_id
  ON public.safety_incidents(crew_id) WHERE crew_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_safety_incidents_supervisor_id
  ON public.safety_incidents(supervisor_id) WHERE supervisor_id IS NOT NULL;
