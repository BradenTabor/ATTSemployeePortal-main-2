/*
  # Fix get_all_app_users function

  1. Changes
    - Fix ambiguous column reference by using table alias
    - Ensure proper admin check
*/

-- Drop and recreate function with fixed query
DROP FUNCTION IF EXISTS get_all_app_users();

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
    SELECT 1 FROM app_users au
    WHERE au.user_id = auth.uid() 
    AND au.role = 'admin'
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
