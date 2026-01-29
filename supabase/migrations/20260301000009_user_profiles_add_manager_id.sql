-- Ensure user_profiles view includes manager_id (and preferred_language)
-- Fixes "column user_profiles.manager_id does not exist" when Phase 2 migration
-- was not applied or view was recreated without these columns.

-- Ensure app_users has manager_id and preferred_language (idempotent)
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'es'));

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_preferred_language ON public.app_users(preferred_language);
CREATE INDEX IF NOT EXISTS idx_app_users_manager_id ON public.app_users(manager_id);

-- Recreate user_profiles view with manager_id and preferred_language
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
  app.preferred_language,
  app.manager_id,
  app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM public;
GRANT SELECT ON public.user_profiles TO authenticated;

COMMENT ON VIEW public.user_profiles IS
  'Joined view of app_users and auth.users. Includes status, preferred_language, manager_id for admin user management and Phase 2.';
