/*
  ============================================================================
  UPDATE user_profiles VIEW TO INCLUDE full_name
  ============================================================================
  
  The user_profiles VIEW was missing the full_name column from app_users,
  causing silent null returns when app code expects it.
  
  This migration:
  1. Recreates the VIEW with full_name included
  2. Updates the get_user_profiles() function to return full_name
  
  ============================================================================
*/

-- ============================================================================
-- STEP 1: RECREATE user_profiles VIEW WITH full_name
-- ============================================================================

CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  app.id,
  app.user_id,
  au.email,
  app.full_name,
  app.role,
  app.created_at
FROM public.app_users app
LEFT JOIN auth.users au ON app.user_id = au.id;

COMMENT ON VIEW public.user_profiles IS 
  'Joins app_users with auth.users to provide email and profile info. Used for admin user management and crew assignment displays.';

-- ============================================================================
-- STEP 2: UPDATE get_user_profiles() FUNCTION
-- ============================================================================
-- Adds full_name to the return type

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
-- VERIFICATION QUERY (run manually after migration)
-- ============================================================================
/*
-- Check view columns include full_name
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Test the view (as admin)
SELECT * FROM user_profiles LIMIT 5;

-- Test the function (as admin)
SELECT * FROM get_user_profiles() LIMIT 5;
*/
