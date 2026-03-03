/*
  ============================================================================
  ADD admin_notes COLUMN TO rto_requests
  ============================================================================

  Adds a dedicated text column for admin-provided notes on RTO decisions.
  Used primarily when an admin denies a request (stores the denial reason).

  No RLS changes needed — the existing admin-only SELECT and UPDATE policies
  on rto_requests already cover all columns.

  ============================================================================
*/

ALTER TABLE public.rto_requests
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

COMMENT ON COLUMN public.rto_requests.admin_notes IS
  'Admin-only notes. Populated on approval/denial with reason. Visible to admin role only (RLS).';
