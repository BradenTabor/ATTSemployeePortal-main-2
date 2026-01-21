-- =============================================================================
-- Migration: Update user_profiles View with Experience Fields
-- Description: Adds hire_date and experience_level to the user_profiles view
--              for Admin User Management experience editing
-- =============================================================================

-- Drop existing view
DROP VIEW IF EXISTS public.user_profiles;

-- Recreate view with hire_date and experience_level columns
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
    app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

-- Grant permissions (maintain existing security model)
REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM public;
GRANT SELECT ON public.user_profiles TO authenticated;

COMMENT ON VIEW public.user_profiles IS 
    'Joined view of app_users and auth.users for admin user management. Includes avatar_url, hire_date, and experience_level.';
