/*
  ============================================================================
  ADD ADMIN RLS POLICIES FOR app_users
  ============================================================================
  Description: Add RLS policies for admin role management
  Date: 2025-12-31
  Reason: Allow admins to update user roles and view all users
  
  Uses the existing public.is_admin() SECURITY DEFINER function to safely
  check admin status without causing RLS recursion.
  ============================================================================
*/

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "app_users_select_admin" ON public.app_users;
DROP POLICY IF EXISTS "app_users_update_admin" ON public.app_users;

-- SELECT policy: Admins can view all users, regular users see only themselves
CREATE POLICY "app_users_select_admin"
  ON public.app_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR user_id = auth.uid());

-- UPDATE policy: Only admins can update any user record
CREATE POLICY "app_users_update_admin"
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Document the policies
COMMENT ON POLICY "app_users_select_admin" ON public.app_users IS 
  'Allows admins to view all users, regular users can only see themselves';
COMMENT ON POLICY "app_users_update_admin" ON public.app_users IS 
  'Allows admins to update any user record using is_admin() function';

