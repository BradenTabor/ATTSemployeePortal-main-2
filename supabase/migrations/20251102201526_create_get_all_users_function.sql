/*
  # Create function to get all users with email

  1. New Function
    - `get_all_app_users()` - Returns all app users with their email addresses
    - Joins app_users with auth.users securely
    - Only accessible by admins

  2. Security
    - Function runs with SECURITY DEFINER to access auth.users
    - Check that caller has admin role before returning data
*/

-- Create function to get all app users with email
CREATE OR REPLACE FUNCTION get_all_app_users()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  email text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM app_users 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Return all app users with their email from auth.users
  RETURN QUERY
  SELECT 
    app.id,
    app.user_id,
    app.role,
    app.created_at,
    au.email
  FROM app_users app
  LEFT JOIN auth.users au ON app.user_id = au.id
  ORDER BY app.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_app_users() TO authenticated;
