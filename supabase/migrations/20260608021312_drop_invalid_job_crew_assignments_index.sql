-- Gate 0 hygiene: remove invalid orphan index (indisvalid=false).
-- Never completed build; invisible to query planner; not in migrations/.
-- No-op if already dropped (prod applied 2026-06-08).

DROP INDEX IF EXISTS public.idx_job_crew_assignments_assigned;
