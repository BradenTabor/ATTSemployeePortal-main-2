/*
  User Management: Block tracking and audit log

  - app_users: status ('active'|'blocked'|'deleted'), blocked_at, blocked_reason
  - user_management_log: audit trail for block, unblock, delete actions
*/

-- Add block tracking to app_users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'deleted')),
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

COMMENT ON COLUMN public.app_users.status IS 'active: normal; blocked: login disabled, data preserved; deleted: removed (audit only)';
COMMENT ON COLUMN public.app_users.blocked_at IS 'When user was blocked (null if not blocked)';
COMMENT ON COLUMN public.app_users.blocked_reason IS 'Optional reason for block (admin-provided)';

-- Audit log for user management actions
CREATE TABLE IF NOT EXISTS public.user_management_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('block', 'unblock', 'delete')),
  target_user_id UUID NOT NULL,
  target_user_email TEXT NOT NULL,
  performed_by_user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_mgmt_log_target ON public.user_management_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_mgmt_log_performed_by ON public.user_management_log(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_user_mgmt_log_created_at ON public.user_management_log(created_at DESC);

COMMENT ON TABLE public.user_management_log IS 'Audit log for block, unblock, delete actions. performed_by_user_id is admin app_users.id.';

-- RLS: only admins can insert/select
ALTER TABLE public.user_management_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_mgmt_log_admin_select" ON public.user_management_log;
CREATE POLICY "user_mgmt_log_admin_select"
  ON public.user_management_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "user_mgmt_log_admin_insert" ON public.user_management_log;
CREATE POLICY "user_mgmt_log_admin_insert"
  ON public.user_management_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
