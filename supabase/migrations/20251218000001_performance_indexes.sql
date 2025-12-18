/*
  ============================================================================
  PERFORMANCE INDEXES MIGRATION
  ============================================================================
  
  This migration adds missing indexes to improve query performance across
  the application. These indexes target:
  
  1. RLS policy checks (user_id lookups)
  2. Common filter/sort patterns
  3. Join operations
  
  All indexes use IF NOT EXISTS for idempotency.
  
  ============================================================================
*/

-- ============================================================================
-- SECTION 1: job_progress_updates indexes
-- ============================================================================
-- user_id is used in RLS policy for filtering user's own updates

CREATE INDEX IF NOT EXISTS idx_job_progress_updates_user_id 
  ON public.job_progress_updates(user_id);

-- Composite index for common query pattern: filter by job, sort by date
CREATE INDEX IF NOT EXISTS idx_job_progress_updates_job_date_desc 
  ON public.job_progress_updates(job_id, date DESC);

-- ============================================================================
-- SECTION 2: job_crew_assignments indexes
-- ============================================================================
-- Reverse order composite for RLS policy existence checks
-- (user_id, job_id) complements existing (job_id, user_id)

CREATE INDEX IF NOT EXISTS idx_job_crew_assignments_user_job 
  ON public.job_crew_assignments(user_id, job_id);

-- ============================================================================
-- SECTION 3: announcements indexes
-- ============================================================================
-- date DESC for dashboard sorting (most recent first)

CREATE INDEX IF NOT EXISTS idx_announcements_date_desc 
  ON public.announcements(date DESC);

-- ============================================================================
-- SECTION 4: rto_requests indexes
-- ============================================================================
-- Composite for filtered pagination (status + submitted_at)

CREATE INDEX IF NOT EXISTS idx_rto_requests_status_submitted 
  ON public.rto_requests(status, submitted_at DESC);

-- email index for current RLS policy (will be deprecated after user_id migration)
CREATE INDEX IF NOT EXISTS idx_rto_requests_email 
  ON public.rto_requests(email);

-- ============================================================================
-- SECTION 5: dvir_reports indexes
-- ============================================================================
-- user_id for RLS policy and user history queries

CREATE INDEX IF NOT EXISTS idx_dvir_reports_user_id 
  ON public.dvir_reports(user_id);

-- Composite for user history with date sorting
CREATE INDEX IF NOT EXISTS idx_dvir_reports_user_created 
  ON public.dvir_reports(user_id, created_at DESC);

-- ============================================================================
-- SECTION 6: daily_equipment_inspections indexes
-- ============================================================================
-- user_id for RLS policy

CREATE INDEX IF NOT EXISTS idx_daily_equipment_inspections_user_id 
  ON public.daily_equipment_inspections(user_id);

-- Composite for user inspection history
CREATE INDEX IF NOT EXISTS idx_daily_equipment_inspections_user_date 
  ON public.daily_equipment_inspections(user_id, inspection_date DESC);

-- Equipment type for filtering
CREATE INDEX IF NOT EXISTS idx_daily_equipment_inspections_equipment_type 
  ON public.daily_equipment_inspections(equipment_type);

-- ============================================================================
-- SECTION 7: contact_requests indexes
-- ============================================================================
-- topic for admin filtering

CREATE INDEX IF NOT EXISTS idx_contact_requests_topic 
  ON public.contact_requests(topic);

-- Composite for topic + date filtering
CREATE INDEX IF NOT EXISTS idx_contact_requests_topic_submitted 
  ON public.contact_requests(topic, submitted_at DESC);

-- ============================================================================
-- SECTION 8: UPDATE STATISTICS
-- ============================================================================
-- Refresh planner statistics after adding indexes

ANALYZE public.job_progress_updates;
ANALYZE public.job_crew_assignments;
ANALYZE public.announcements;
ANALYZE public.rto_requests;
ANALYZE public.dvir_reports;
ANALYZE public.daily_equipment_inspections;
ANALYZE public.contact_requests;

-- ============================================================================
-- VERIFICATION QUERY (run manually after migration)
-- ============================================================================
/*
SELECT 
  schemaname,
  tablename, 
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN (
    'job_progress_updates',
    'job_crew_assignments', 
    'announcements',
    'rto_requests',
    'dvir_reports',
    'daily_equipment_inspections',
    'contact_requests'
  )
ORDER BY tablename, indexname;
*/
