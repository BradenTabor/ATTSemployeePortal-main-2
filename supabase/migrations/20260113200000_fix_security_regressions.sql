/*
  ============================================================================
  FIX SECURITY REGRESSIONS FROM ADVISOR FIXES
  ============================================================================
  
  This migration fixes three issues introduced by the security advisor fixes:
  
  ## Issue 1: user_profiles view broken (Jobs not showing crew members)
  The security advisor changed user_profiles to security_invoker=true, which
  means it runs with the calling user's permissions. Regular users don't have
  access to auth.users, so the view fails silently.
  
  FIX: Recreate as SECURITY DEFINER view but only grant to authenticated users
  (not anon) to prevent auth data exposure.
  
  ## Issue 2: announcement_rewards INSERT policy missing (Collect Points broken)
  The security advisor dropped "Users can claim rewards" (INSERT policy) but
  only created "Rewards claim own" as an UPDATE policy.
  
  FIX: Add the missing INSERT policy for announcement_rewards.
  
  ## Issue 3: Admin User Management "permission denied for table users"
  Code was querying "users" directly instead of using user_profiles view.
  This is a code fix, not a database fix (see AdminUserManager.tsx).
  
  ============================================================================
*/

-- ============================================================================
-- FIX 1: Restore user_profiles as SECURITY DEFINER view
-- ============================================================================
-- The view needs SECURITY DEFINER to access auth.users, but we restrict
-- grants to authenticated only (not anon) to prevent auth data exposure.

DROP VIEW IF EXISTS public.user_profiles;

CREATE VIEW public.user_profiles 
WITH (security_barrier = true) AS
SELECT
  app.id,
  app.user_id,
  au.email,
  app.full_name,
  app.role,
  app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

-- Make it security definer so it can access auth.users
ALTER VIEW public.user_profiles SET (security_invoker = false);

-- Grant only to authenticated (NOT anon) to prevent auth.users exposure
REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM public;
GRANT SELECT ON public.user_profiles TO authenticated;

COMMENT ON VIEW public.user_profiles IS 
  'Joins app_users with auth.users to provide email and profile info. Uses SECURITY DEFINER to access auth.users but restricted to authenticated users only.';


-- ============================================================================
-- FIX 2: Add missing INSERT policy for announcement_rewards
-- ============================================================================
-- The security advisor migration dropped the INSERT policy and only created
-- an UPDATE policy. Users need INSERT to claim rewards.

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Rewards claim own" ON public.announcement_rewards;
DROP POLICY IF EXISTS "Rewards insert own" ON public.announcement_rewards;
DROP POLICY IF EXISTS "Rewards update own" ON public.announcement_rewards;

-- Recreate with both INSERT and UPDATE capabilities
-- Policy for INSERT: Users can claim their own rewards
CREATE POLICY "Rewards insert own" ON public.announcement_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Policy for UPDATE: Users can update their own rewards (if needed in future)
CREATE POLICY "Rewards update own" ON public.announcement_rewards
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Verify the SELECT policy exists (should have been created by security advisor)
-- If not, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'announcement_rewards' 
    AND policyname = 'Rewards read own or admin'
  ) THEN
    CREATE POLICY "Rewards read own or admin" ON public.announcement_rewards
      FOR SELECT
      TO authenticated
      USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.app_users
          WHERE app_users.user_id = (SELECT auth.uid())
          AND app_users.role = 'admin'
        )
      );
  END IF;
END $$;


-- ============================================================================
-- FIX 3: Ensure cron_job_runs view works for authenticated users
-- ============================================================================
-- This view also needs SECURITY DEFINER to access cron schema

DROP VIEW IF EXISTS public.cron_job_runs;

CREATE VIEW public.cron_job_runs AS
SELECT 
  j.jobname,
  r.runid,
  r.job_pid,
  r.status,
  r.start_time,
  r.end_time,
  (r.end_time - r.start_time) AS duration,
  r.return_message
FROM cron.job j
JOIN cron.job_run_details r ON j.jobid = r.jobid
WHERE j.jobname IN ('safety-announcement-7am', 'admin-compliance-9am')
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS 
  'Monitoring view for safety-related scheduled cron jobs.';


-- ============================================================================
-- FIX 4: Ensure scheduled_cron_jobs view works
-- ============================================================================

DROP VIEW IF EXISTS public.scheduled_cron_jobs;

CREATE VIEW public.scheduled_cron_jobs AS
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
WHERE jobname LIKE 'safety-announcement%' 
   OR jobname LIKE 'admin-compliance%';

GRANT SELECT ON public.scheduled_cron_jobs TO authenticated;

COMMENT ON VIEW public.scheduled_cron_jobs IS 
  'View of safety-related scheduled cron jobs for monitoring.';


-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  view_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify views exist
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
  AND table_name IN ('user_profiles', 'cron_job_runs', 'scheduled_cron_jobs');
  
  -- Verify announcement_rewards has INSERT policy
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'announcement_rewards'
  AND cmd = 'INSERT';
  
  RAISE NOTICE 'Security regression fixes applied:';
  RAISE NOTICE '  - Views created: %/3', view_count;
  RAISE NOTICE '  - announcement_rewards INSERT policies: %', policy_count;
  
  IF view_count < 3 THEN
    RAISE WARNING 'Some views may not have been created correctly!';
  END IF;
  
  IF policy_count < 1 THEN
    RAISE WARNING 'announcement_rewards INSERT policy may be missing!';
  END IF;
END $$;
