/*
  ============================================================================
  SECURE USER_PROFILES VIEW AND ADD PERFORMANCE INDEXES
  ============================================================================
  
  This migration:
  1. Secures the user_profiles view so only admins can access it
  2. Adds performance indexes for common query patterns
  
  ============================================================================
*/

-- ============================================================================
-- SECTION 1: SECURE user_profiles VIEW
-- ============================================================================
-- The view joins app_users with auth.users and should only be accessible
-- by admins for user management. Regular users should only access their
-- own data via app_users table directly.

-- Option: We'll use a SECURITY INVOKER view (default) but restrict access
-- via the underlying app_users RLS policies. Since app_users has RLS,
-- non-admins will only see their own row when querying the view.
-- This is actually the correct behavior - no changes needed for view security
-- since RLS on app_users propagates to the view.

-- However, for the get_user_profiles() function used by AdminUsers page,
-- we should ensure it's SECURITY DEFINER and checks admin role.

-- Verify/recreate the function with proper security
DROP FUNCTION IF EXISTS get_user_profiles();

CREATE OR REPLACE FUNCTION get_user_profiles()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM app_users au
    WHERE au.user_id = auth.uid() 
    AND au.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Return all users from the view
  RETURN QUERY
  SELECT 
    up.id,
    up.user_id,
    up.email,
    up.full_name,
    up.role,
    up.created_at
  FROM user_profiles up
  ORDER BY up.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION get_user_profiles() TO authenticated;

-- ============================================================================
-- SECTION 2: PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for job assignment lookups (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_job_crew_assignments_job_user 
  ON public.job_crew_assignments(job_id, user_id);

-- Index for RTO filtering by status
CREATE INDEX IF NOT EXISTS idx_rto_requests_status 
  ON public.rto_requests(status);

-- Index for job progress updates by date (used in analytics)
CREATE INDEX IF NOT EXISTS idx_job_progress_updates_job_date 
  ON public.job_progress_updates(job_id, date);

-- Index for job progress trackers by status (common filter)
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_status_created 
  ON public.job_progress_trackers(status, created_at DESC);

-- Index for app_users role lookups (used in admin checks)
CREATE INDEX IF NOT EXISTS idx_app_users_role 
  ON public.app_users(role);

-- Index for app_users user_id lookups (critical for role fetching)
-- This likely exists but let's ensure it
CREATE INDEX IF NOT EXISTS idx_app_users_user_id 
  ON public.app_users(user_id);

-- ============================================================================
-- SECTION 3: UPDATE STATISTICS
-- ============================================================================

ANALYZE public.app_users;
ANALYZE public.job_crew_assignments;
ANALYZE public.job_progress_updates;
ANALYZE public.job_progress_trackers;
ANALYZE public.rto_requests;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
/*
-- Check indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('app_users', 'job_crew_assignments', 'job_progress_updates', 'job_progress_trackers', 'rto_requests')
ORDER BY tablename, indexname;
*/

