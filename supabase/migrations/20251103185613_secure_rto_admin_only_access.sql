/*
  # Secure RTO Requests - Admin-Only Read Access

  1. Changes
    - DROP existing "Users can view own requests" policy
    - Employees can NO LONGER read/select any RTO data
    - Only admins can view all RTO requests
    - All authenticated users can still INSERT (submit) requests
    - Admins retain UPDATE permissions for status changes

  2. Security Model
    - SELECT: Admin-only (via app_users.role = 'admin' check)
    - INSERT: All authenticated users (form submissions)
    - UPDATE: Admin-only (for status approval/denial)
    - DELETE: Not allowed (no policy = no access)

  3. Impact
    - ✅ Admins see all RTO data in Admin RTO page
    - ✅ Employees can submit RTO requests via form
    - ✅ Make.com webhook continues to work
    - ❌ Employees cannot read/view any RTO data
    - ✅ Real-time updates continue for admin dashboard

  4. Important Notes
    - This enforces strict separation: employees submit, admins review
    - Form submission uses INSERT policy (no SELECT needed)
    - Webhook inserts data directly (service role bypasses RLS)
    - Frontend AdminRTO page requires admin role check
*/

-- Drop the policy that allows users to view their own requests
DROP POLICY IF EXISTS "Users can view own requests" ON public.rto_requests;

-- Verify admin-only SELECT policy exists (it should from initial migration)
-- This ensures only users with role='admin' in app_users can read RTO data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rto_requests' 
    AND policyname = 'Admins can view all requests'
  ) THEN
    CREATE POLICY "Admins can view all requests"
      ON public.rto_requests
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.app_users
          WHERE app_users.id = auth.uid()
          AND app_users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Verify authenticated INSERT policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rto_requests' 
    AND policyname = 'Authenticated users can insert time off requests'
  ) THEN
    CREATE POLICY "Authenticated users can insert time off requests"
      ON public.rto_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Verify admin UPDATE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'rto_requests' 
    AND policyname = 'Admins can update request status'
  ) THEN
    CREATE POLICY "Admins can update request status"
      ON public.rto_requests
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.app_users
          WHERE app_users.id = auth.uid()
          AND app_users.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.app_users
          WHERE app_users.id = auth.uid()
          AND app_users.role = 'admin'
        )
      );
  END IF;
END $$;

-- Ensure RLS is enabled on rto_requests
ALTER TABLE public.rto_requests ENABLE ROW LEVEL SECURITY;
