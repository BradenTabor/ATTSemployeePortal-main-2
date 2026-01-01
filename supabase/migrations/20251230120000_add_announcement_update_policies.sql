/*
  ============================================================================
  ADD ANNOUNCEMENT UPDATE/DELETE POLICIES FOR ADMINS
  ============================================================================
  
  Enables admins to update and delete announcements.
  Uses public.is_admin() helper function consistent with other admin policies.
  
  All operations are idempotent (safe to run multiple times).
  ============================================================================
*/

-- Drop existing policies if they exist (idempotency)
DROP POLICY IF EXISTS "announcements_update_admin" ON public.announcements;
DROP POLICY IF EXISTS "announcements_delete_admin" ON public.announcements;

-- Enable RLS (in case it's not already enabled)
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Admins can update announcements
CREATE POLICY "announcements_update_admin"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete announcements  
CREATE POLICY "announcements_delete_admin"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Update statistics
ANALYZE public.announcements;

