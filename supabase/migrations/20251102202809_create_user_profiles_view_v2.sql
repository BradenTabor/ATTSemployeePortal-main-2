/*
  # Create user_profiles view

  1. New View
    - `user_profiles` - Simple view joining auth.users and app_users
    - Provides email, role, and other user data
    - Used by secure function for admin access

  2. Security
    - View itself has no direct access from client
    - Access controlled via get_user_profiles() function
*/

-- Drop the old function first
DROP FUNCTION IF EXISTS get_all_app_users();

-- Create a secure view that joins auth.users and app_users
CREATE OR REPLACE VIEW user_profiles AS
SELECT
  app.id,
  app.user_id,
  au.email,
  app.role,
  app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

-- Create a secure function to access the view
CREATE OR REPLACE FUNCTION get_user_profiles()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  email text,
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
    up.role,
    up.created_at
  FROM user_profiles up
  ORDER BY up.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profiles() TO authenticated;
