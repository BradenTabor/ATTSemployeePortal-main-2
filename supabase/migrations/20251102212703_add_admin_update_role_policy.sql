/*
  # Add RLS Policy for Admin Role Updates

  ## Overview
  This migration adds a Row Level Security (RLS) policy to allow administrators
  to update user roles in the app_users table. Previously, only SELECT and INSERT
  policies existed, preventing admins from persisting role changes.

  ## Changes
  1. New Policy: "Admins can update user roles"
     - Type: UPDATE policy
     - Applies to: authenticated users with 'admin' role
     - Allows: Updating any user's role field
     - Security: Verifies requesting user is an admin before allowing update

  ## Security
  - USING clause: Checks if the requesting user is an admin
  - WITH CHECK clause: Double-checks admin status on row update
  - Only authenticated users with admin role can execute updates
  - Non-admin users cannot update any roles

  ## Important Notes
  - Does not modify authentication flow
  - Does not affect signup/login behavior
  - Maintains data integrity with double verification
  - Follows principle of least privilege
*/

-- Create policy to allow admins to update user roles
CREATE POLICY "Admins can update user roles"
  ON public.app_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.app_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.app_users au
      WHERE au.user_id = auth.uid()
        AND au.role = 'admin'
    )
  );
