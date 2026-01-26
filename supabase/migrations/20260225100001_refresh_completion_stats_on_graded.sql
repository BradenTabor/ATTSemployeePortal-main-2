-- =============================================================================
-- Refresh certification_completion_stats when a test is graded or a new
-- certification record is created, so the materialized view (visible in
-- Supabase Table Editor) stays in sync without waiting for daily cron.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.refresh_certification_completion_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.certification_completion_stats;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.refresh_certification_completion_stats() IS
  'Trigger function: refreshes certification_completion_stats MV so Supabase Table Editor shows current counts.';

-- When an attempt is graded, refresh the stats MV
DROP TRIGGER IF EXISTS trigger_refresh_completion_stats_on_attempt_graded ON public.certification_attempts;
CREATE TRIGGER trigger_refresh_completion_stats_on_attempt_graded
  AFTER UPDATE OF status, passed ON public.certification_attempts
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM 'graded' AND NEW.status = 'graded'
  )
  EXECUTE FUNCTION public.refresh_certification_completion_stats();

-- When a new certification record is created (user passed), refresh the stats MV
DROP TRIGGER IF EXISTS trigger_refresh_completion_stats_on_record_insert ON public.certification_records;
CREATE TRIGGER trigger_refresh_completion_stats_on_record_insert
  AFTER INSERT ON public.certification_records
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_certification_completion_stats();
