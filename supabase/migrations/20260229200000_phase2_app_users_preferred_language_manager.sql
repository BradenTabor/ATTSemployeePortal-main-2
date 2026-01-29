-- Phase 2: preferred_language and manager_id on app_users
-- Multi-language support (e.g. Spanish) and individual manager notifications.

-- app_users: preferred language for announcements and future form i18n
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'es'));

-- app_users: manager for direct reports (used for manager-specific compliance emails)
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_preferred_language ON public.app_users(preferred_language);
CREATE INDEX IF NOT EXISTS idx_app_users_manager_id ON public.app_users(manager_id);

COMMENT ON COLUMN public.app_users.preferred_language IS 'User language preference (en/es) for announcements and future form localization';
COMMENT ON COLUMN public.app_users.manager_id IS 'Direct manager for compliance reporting and manager-specific notifications';

-- Allow users to update their own preferred_language (like update_my_avatar_url)
CREATE OR REPLACE FUNCTION public.update_my_preferred_language(p_lang text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.app_users
  SET preferred_language = p_lang
  WHERE user_id = auth.uid()
  AND p_lang IN ('en', 'es');
$$;

COMMENT ON FUNCTION public.update_my_preferred_language(text) IS
  'Allows authenticated users to set their preferred language (en or es).';

GRANT EXECUTE ON FUNCTION public.update_my_preferred_language(text) TO authenticated;

-- Recreate user_profiles view to include preferred_language and manager_id
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
  'Joined view of app_users and auth.users. Includes preferred_language, manager_id for Phase 2.';
