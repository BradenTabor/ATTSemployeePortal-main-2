/*
  Add status, blocked_at, blocked_reason to user_profiles view
  (requires 20260228100000_user_management_status_and_audit)
*/

DROP VIEW IF EXISTS public.user_profiles;

CREATE VIEW public.user_profiles AS
SELECT
  app.id,
  app.user_id,
  au.email,
  app.full_name,
  app.role,
  app.avatar_url,
  app.hire_date,
  app.experience_level,
  app.status,
  app.blocked_at,
  app.blocked_reason,
  app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM public;
GRANT SELECT ON public.user_profiles TO authenticated;

COMMENT ON VIEW public.user_profiles IS
  'Joined view of app_users and auth.users. Includes status, blocked_at, blocked_reason for user management.';
