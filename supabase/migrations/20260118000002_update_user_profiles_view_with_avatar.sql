/*
  # Update User Profiles View to Include Avatar URL

  ## Changes
  - Added avatar_url column from app_users to the user_profiles view
  - This allows admin user management pages to display user avatars
*/

-- Drop and recreate user_profiles view to include avatar_url
DROP VIEW IF EXISTS public.user_profiles;

CREATE VIEW public.user_profiles AS
SELECT 
    app.id,
    app.user_id,
    au.email,
    app.full_name,
    app.role,
    app.avatar_url,
    app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

COMMENT ON VIEW public.user_profiles IS 
    'Joined view of app_users and auth.users for admin user management. Includes avatar_url.';
