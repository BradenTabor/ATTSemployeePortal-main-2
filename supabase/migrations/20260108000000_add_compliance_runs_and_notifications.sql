/*
  ============================================================================
  COMPLIANCE RUNS AND NOTIFICATIONS TABLES
  ============================================================================
  
  Creates tables to support the AI Safety + Compliance Agent:
  
  1. public.compliance_runs - Audit table for each compliance check execution
  2. public.compliance_notifications - Deduplicated notification log
  
  Key features:
  - Unique constraint prevents duplicate notifications per user/day/type
  - updated_at trigger for tracking changes
  - Indexes for query performance
  
  All operations are idempotent (safe to run multiple times).
  ============================================================================
*/

-- =============================================================================
-- TABLE: compliance_runs
-- =============================================================================
-- Audit table that records each execution of the compliance checker.
-- One row per run, tracking counts and status.

CREATE TABLE IF NOT EXISTS public.compliance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Run identification
  run_type text NOT NULL DEFAULT 'dvir_equipment_9am',
  date_for date NOT NULL,
  cutoff_time timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  
  -- Timing
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  
  -- Status
  status text NOT NULL DEFAULT 'running' 
    CHECK (status IN ('running', 'success', 'failed')),
  
  -- Counts
  required_user_count integer,
  missing_dvir_count integer,
  missing_equipment_count integer,
  missing_both_count integer,
  webhooks_sent integer NOT NULL DEFAULT 0,
  webhooks_skipped integer NOT NULL DEFAULT 0,
  
  -- Flags
  dry_run boolean NOT NULL DEFAULT false,
  
  -- Error tracking
  error text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comment
COMMENT ON TABLE public.compliance_runs IS 
  'Audit log of compliance check executions. One row per scheduled or manual run.';

-- =============================================================================
-- TABLE: compliance_notifications
-- =============================================================================
-- Tracks individual notifications sent to users.
-- Unique constraint ensures we never send duplicate notifications.

CREATE TABLE IF NOT EXISTS public.compliance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Target identification
  date_for date NOT NULL,
  user_id uuid NOT NULL REFERENCES public.app_users(user_id) ON DELETE CASCADE,
  notification_type text NOT NULL 
    CHECK (notification_type IN ('missing_dvir', 'missing_equipment', 'missing_both')),
  
  -- Delivery details
  sent_to text NOT NULL, -- email address
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at timestamptz,
  
  -- Webhook response tracking
  webhook_response jsonb,
  error text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- UNIQUE CONSTRAINT: Prevents duplicate notifications
  -- This is the key to idempotency - if we try to insert a duplicate,
  -- the insert will fail (or we can use ON CONFLICT DO NOTHING)
  CONSTRAINT unique_notification_per_user_day_type 
    UNIQUE (date_for, user_id, notification_type)
);

-- Comment
COMMENT ON TABLE public.compliance_notifications IS 
  'Log of compliance notifications sent to users. Unique constraint prevents duplicates.';

COMMENT ON CONSTRAINT unique_notification_per_user_day_type ON public.compliance_notifications IS
  'Ensures only one notification per user per day per type. Key to idempotency.';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- compliance_runs indexes
CREATE INDEX IF NOT EXISTS idx_compliance_runs_date_for 
  ON public.compliance_runs(date_for DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_runs_status 
  ON public.compliance_runs(status);

CREATE INDEX IF NOT EXISTS idx_compliance_runs_run_type_date 
  ON public.compliance_runs(run_type, date_for DESC);

-- compliance_notifications indexes
CREATE INDEX IF NOT EXISTS idx_compliance_notifications_date_for 
  ON public.compliance_notifications(date_for DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_notifications_user_id 
  ON public.compliance_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_compliance_notifications_status 
  ON public.compliance_notifications(status);

-- =============================================================================
-- TRIGGER: updated_at for compliance_runs
-- =============================================================================
-- Reuses the existing update_updated_at_column() function

DROP TRIGGER IF EXISTS trigger_compliance_runs_updated_at ON public.compliance_runs;

CREATE TRIGGER trigger_compliance_runs_updated_at
  BEFORE UPDATE ON public.compliance_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE public.compliance_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "compliance_runs_service_role_all" ON public.compliance_runs;
DROP POLICY IF EXISTS "compliance_runs_admin_select" ON public.compliance_runs;
DROP POLICY IF EXISTS "compliance_notifications_service_role_all" ON public.compliance_notifications;
DROP POLICY IF EXISTS "compliance_notifications_admin_select" ON public.compliance_notifications;
DROP POLICY IF EXISTS "compliance_notifications_user_select_own" ON public.compliance_notifications;

-- Service role has full access (for Edge Functions)
-- Note: Service role bypasses RLS by default, but explicit policies are good practice

-- Admins can view all compliance runs
CREATE POLICY "compliance_runs_admin_select"
  ON public.compliance_runs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can view all notifications
CREATE POLICY "compliance_notifications_admin_select"
  ON public.compliance_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Users can view their own notifications
CREATE POLICY "compliance_notifications_user_select_own"
  ON public.compliance_notifications
  FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT au.user_id FROM public.app_users au WHERE au.user_id = auth.uid()
  ));

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'compliance_runs') THEN
    RAISE EXCEPTION 'compliance_runs table was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'compliance_notifications') THEN
    RAISE EXCEPTION 'compliance_notifications table was not created';
  END IF;
  
  -- Verify unique constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_notification_per_user_day_type'
  ) THEN
    RAISE EXCEPTION 'unique constraint was not created';
  END IF;
  
  RAISE NOTICE 'Compliance tables created successfully!';
END $$;

