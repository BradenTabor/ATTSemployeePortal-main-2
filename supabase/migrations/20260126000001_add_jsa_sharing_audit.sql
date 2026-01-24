/*
  ============================================================================
  CREATE JSA SHARING AUDIT TABLE
  ============================================================================
  Description: Tracks all delegation changes for compliance and audit purposes.
               Records who added/removed users, when, and which JSA.
  Date: 2026-01-26
  
  Security: Admin-only access for viewing audit logs.
  
  Changes:
  1. Create jsa_sharing_audit table
  2. Add indexes for performance
  3. Add RLS policies (admin-only SELECT)
  ============================================================================
*/

-- ============================================================================
-- STEP 1: Create audit table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jsa_sharing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jsa_id UUID NOT NULL REFERENCES public.daily_jsa(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed')),
  shared_user_id UUID NOT NULL,
  shared_user_email TEXT,
  shared_user_name TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.jsa_sharing_audit IS 
'Audit trail for JSA user delegation changes. Tracks who added/removed users, when, and which JSA. Admin-only access.';

COMMENT ON COLUMN public.jsa_sharing_audit.jsa_id IS 
'Reference to the JSA that was modified.';

COMMENT ON COLUMN public.jsa_sharing_audit.action IS 
'Action taken: "added" or "removed" a user from delegation.';

COMMENT ON COLUMN public.jsa_sharing_audit.shared_user_id IS 
'UUID of the user who was added or removed from delegation.';

COMMENT ON COLUMN public.jsa_sharing_audit.shared_user_email IS 
'Email of the user at time of change (preserved for audit even if user deleted).';

COMMENT ON COLUMN public.jsa_sharing_audit.shared_user_name IS 
'Full name of the user at time of change (preserved for audit even if user deleted).';

COMMENT ON COLUMN public.jsa_sharing_audit.changed_by IS 
'UUID of the user who made the change (typically the JSA owner).';

-- ============================================================================
-- STEP 2: Add indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_jsa_sharing_audit_jsa_id 
ON public.jsa_sharing_audit(jsa_id);

CREATE INDEX IF NOT EXISTS idx_jsa_sharing_audit_changed_at 
ON public.jsa_sharing_audit(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_jsa_sharing_audit_changed_by 
ON public.jsa_sharing_audit(changed_by);

CREATE INDEX IF NOT EXISTS idx_jsa_sharing_audit_shared_user_id 
ON public.jsa_sharing_audit(shared_user_id);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE public.jsa_sharing_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create RLS policies (admin-only SELECT)
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "jsa_sharing_audit_select_admin" ON public.jsa_sharing_audit;
DROP POLICY IF EXISTS "jsa_sharing_audit_insert" ON public.jsa_sharing_audit;

-- Admins can view audit logs
CREATE POLICY "jsa_sharing_audit_select_admin" ON public.jsa_sharing_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = (SELECT auth.uid())
      AND app_users.role = 'admin'
    )
  );

COMMENT ON POLICY "jsa_sharing_audit_select_admin" ON public.jsa_sharing_audit IS 
'Only admins can view JSA sharing audit logs for compliance purposes.';

-- Allow inserts from application (for logging delegation changes)
-- Note: Application code will insert records, not users directly
-- This policy allows the application to log changes
CREATE POLICY "jsa_sharing_audit_insert" ON public.jsa_sharing_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "jsa_sharing_audit_insert" ON public.jsa_sharing_audit IS 
'Application can insert audit records when delegation changes occur.';

-- ============================================================================
-- STEP 5: Verify table creation
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'jsa_sharing_audit'
  ) THEN
    RAISE NOTICE 'SUCCESS: jsa_sharing_audit table created';
  ELSE
    RAISE WARNING 'FAILED: jsa_sharing_audit table not found';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 
-- Usage:
-- - Application code should insert records when shared_with_users changes
-- - Compare previous vs current shared_with_users arrays
-- - Log added users: action='added'
-- - Log removed users: action='removed'
--
-- Access:
-- - Only admins can query this table
-- - Used for compliance audits and troubleshooting
--
-- Performance:
-- - Indexes on jsa_id, changed_at, changed_by, shared_user_id
-- - CASCADE delete when JSA is deleted
-- ============================================================================
