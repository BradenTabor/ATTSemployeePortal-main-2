/*
  # Fix RTO RLS Policies to Use Correct user_id Column

  1. Problem
    - Existing policies check `app_users.id = auth.uid()`
    - But `app_users.id` is the primary key (auto-generated UUID)
    - Should check `app_users.user_id = auth.uid()` instead
    - This is why admins couldn't see RTO data

  2. Changes
    - Drop duplicate/incorrect policies
    - Create correct policies using `user_id` column
    - Ensure proper roles (authenticated only)

  3. Security Model
    - SELECT: Admins only (via user_id check)
    - INSERT: All authenticated users
    - UPDATE: Admins only (via user_id check)
    - DELETE: Not allowed

  4. Impact
    - ✅ Admins can now view all RTO requests
    - ✅ Employees can submit RTO requests
    - ✅ Proper user authentication checks
*/

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "Admins can view all RTO requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can insert time off requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Authenticated users can submit RTO requests" ON public.rto_requests;
DROP POLICY IF EXISTS "Admins can update request status" ON public.rto_requests;

-- Ensure RLS is enabled
ALTER TABLE public.rto_requests ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view all RTO requests
CREATE POLICY "Admins can view all RTO requests"
  ON public.rto_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

-- Policy 2: All authenticated users can submit RTO requests
CREATE POLICY "Authenticated users can submit RTO requests"
  ON public.rto_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy 3: Admins can update request status
CREATE POLICY "Admins can update request status"
  ON public.rto_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role = 'admin'
    )
  );
