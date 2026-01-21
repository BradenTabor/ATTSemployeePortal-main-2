-- ============================================================================
-- Migration: Create Telemetry Events Table
-- Version: 20260116100000
-- Description: Production instrumentation for form analytics, engagement tracking,
--              and ROI measurement. Privacy-first design with GDPR compliance.
-- ============================================================================

-- ============================================================================
-- 1. CREATE ANONYMIZATION FUNCTION (must exist before trigger)
-- ============================================================================

-- Function to anonymize telemetry when user is deleted (GDPR compliance)
CREATE OR REPLACE FUNCTION public.anonymize_user_telemetry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set user_id to NULL for all telemetry events belonging to deleted user
  -- This preserves aggregate data while removing personal identifiers
  UPDATE public.telemetry_events 
  SET user_id = NULL 
  WHERE user_id = OLD.id;
  
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.anonymize_user_telemetry() IS 
  'GDPR Right to Erasure: Anonymizes telemetry data when user account is deleted';

-- ============================================================================
-- 2. CREATE TELEMETRY EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.telemetry_events (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Timestamp (required)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- User context (nullable for anonymous/pre-auth events)
  -- References auth.users with ON DELETE SET NULL for manual deletion support
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Session identifier (required)
  -- Format: sess_<uuid> - persists across page reloads, resets on browser close
  session_id TEXT NOT NULL,
  
  -- Event name (required, constrained to allowlist)
  event_name TEXT NOT NULL CHECK (event_name IN (
    'form_started',
    'form_submitted',
    'form_submit_error',
    'announcement_viewed',
    'form_duplicate_detected',
    'form_duplicate_prevented',
    'form_duplicate_overridden'
  )),
  
  -- Event properties (flexible JSONB)
  -- Contains: form_type, duration_seconds, error_code, field_name, etc.
  -- FORBIDDEN: PII, free-text notes, signatures, photos
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Page context
  route TEXT,  -- e.g., '/forms/dvir'
  
  -- Denormalized form_type for efficient querying
  form_type TEXT CHECK (form_type IS NULL OR form_type IN (
    'dvir',
    'equipment', 
    'rto',
    'jsa'
  ))
);

COMMENT ON TABLE public.telemetry_events IS 
  'Production telemetry for form analytics and engagement tracking. Contains NO PII. Aggregates only for reporting. 90-day retention policy.';

COMMENT ON COLUMN public.telemetry_events.user_id IS 
  'User who triggered the event. Set to NULL on account deletion (GDPR).';

COMMENT ON COLUMN public.telemetry_events.session_id IS 
  'Browser session identifier. Persists across page reloads, resets on browser close.';

COMMENT ON COLUMN public.telemetry_events.properties IS 
  'Event-specific properties. MUST NOT contain PII, signatures, or free-text.';

-- ============================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary query pattern: recent events by date
CREATE INDEX idx_telemetry_events_created_at 
  ON public.telemetry_events(created_at DESC);

-- Filter by event type
CREATE INDEX idx_telemetry_events_event_name 
  ON public.telemetry_events(event_name);

-- Filter by form type (partial index for non-null values)
CREATE INDEX idx_telemetry_events_form_type 
  ON public.telemetry_events(form_type) 
  WHERE form_type IS NOT NULL;

-- User-specific queries (partial index for non-null values)
CREATE INDEX idx_telemetry_events_user_id 
  ON public.telemetry_events(user_id) 
  WHERE user_id IS NOT NULL;

-- Session-based queries
CREATE INDEX idx_telemetry_events_session_id 
  ON public.telemetry_events(session_id);

-- Composite index for common dashboard query
CREATE INDEX idx_telemetry_events_dashboard 
  ON public.telemetry_events(created_at DESC, event_name, form_type);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES
-- ============================================================================

-- Policy 1: Authenticated users can insert their own events
-- Allows user_id = auth.uid() OR user_id IS NULL (for anonymous tracking)
CREATE POLICY "telemetry_insert_own"
  ON public.telemetry_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

COMMENT ON POLICY "telemetry_insert_own" ON public.telemetry_events IS
  'Users can insert telemetry events for themselves or anonymously';

-- Policy 2: Admins can read all telemetry events (for aggregation/dashboard)
CREATE POLICY "telemetry_admin_read"
  ON public.telemetry_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() 
      AND app_users.role = 'admin'
    )
  );

COMMENT ON POLICY "telemetry_admin_read" ON public.telemetry_events IS
  'Admins can read telemetry for dashboard aggregation. MUST use aggregate queries only.';

-- Policy 3: Service role has full access (for Edge Functions and scripts)
CREATE POLICY "telemetry_service_role_all"
  ON public.telemetry_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "telemetry_service_role_all" ON public.telemetry_events IS
  'Service role has full access for Edge Functions (flush-telemetry) and admin scripts';

-- ============================================================================
-- 6. CREATE GDPR ANONYMIZATION TRIGGER
-- ============================================================================

-- Drop existing trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_anonymize_telemetry_on_user_delete ON auth.users;

-- Create trigger to anonymize telemetry when user is deleted
CREATE TRIGGER trigger_anonymize_telemetry_on_user_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.anonymize_user_telemetry();

-- ============================================================================
-- 7. CREATE AGGREGATE FUNCTION FOR DASHBOARD (Secure)
-- ============================================================================

-- This function provides aggregated stats only, preventing raw data exposure
CREATE OR REPLACE FUNCTION public.get_telemetry_dashboard_stats(
  date_from TIMESTAMPTZ DEFAULT now() - interval '14 days',
  date_to TIMESTAMPTZ DEFAULT now()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Authorization check: only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  SELECT json_build_object(
    'period', json_build_object(
      'from', date_from,
      'to', date_to
    ),
    'summary', json_build_object(
      'total_events', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE created_at BETWEEN date_from AND date_to
      ),
      'unique_sessions', (
        SELECT COUNT(DISTINCT session_id) FROM telemetry_events 
        WHERE created_at BETWEEN date_from AND date_to
      ),
      'unique_users', (
        SELECT COUNT(DISTINCT user_id) FROM telemetry_events 
        WHERE created_at BETWEEN date_from AND date_to
        AND user_id IS NOT NULL
      )
    ),
    'forms', json_build_object(
      'total_started', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'form_started' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'total_submitted', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'form_submitted' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'total_errors', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'form_submit_error' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'by_type', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          SELECT 
            form_type,
            COUNT(*) FILTER (WHERE event_name = 'form_started') AS started,
            COUNT(*) FILTER (WHERE event_name = 'form_submitted') AS submitted,
            COUNT(*) FILTER (WHERE event_name = 'form_submit_error') AS errors
          FROM telemetry_events
          WHERE created_at BETWEEN date_from AND date_to
          AND form_type IS NOT NULL
          GROUP BY form_type
          ORDER BY form_type
        ) t
      ),
      'completion_times', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          SELECT 
            form_type,
            ROUND(percentile_cont(0.5) WITHIN GROUP (
              ORDER BY (properties->>'duration_seconds')::numeric
            )::numeric, 1) AS p50_seconds,
            ROUND(percentile_cont(0.9) WITHIN GROUP (
              ORDER BY (properties->>'duration_seconds')::numeric
            )::numeric, 1) AS p90_seconds,
            COUNT(*) AS sample_size
          FROM telemetry_events
          WHERE event_name = 'form_submitted'
          AND created_at BETWEEN date_from AND date_to
          AND form_type IS NOT NULL
          AND properties->>'duration_seconds' IS NOT NULL
          GROUP BY form_type
          ORDER BY form_type
        ) t
      )
    ),
    'announcements', json_build_object(
      'total_views', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'announcement_viewed' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'unique_sessions', (
        SELECT COUNT(DISTINCT session_id) FROM telemetry_events 
        WHERE event_name = 'announcement_viewed' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'ai_generated_views', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'announcement_viewed' 
        AND created_at BETWEEN date_from AND date_to
        AND (properties->>'is_ai_generated')::boolean = true
      )
    ),
    'duplicates', json_build_object(
      'detected', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'form_duplicate_detected' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'prevented', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'form_duplicate_prevented' 
        AND created_at BETWEEN date_from AND date_to
      ),
      'overridden', (
        SELECT COUNT(*) FROM telemetry_events 
        WHERE event_name = 'form_duplicate_overridden' 
        AND created_at BETWEEN date_from AND date_to
      )
    ),
    'timeline', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json)
      FROM (
        SELECT 
          date_trunc('day', created_at)::date AS day,
          COUNT(*) FILTER (WHERE event_name = 'form_submitted') AS form_submissions,
          COUNT(*) FILTER (WHERE event_name = 'form_submit_error') AS form_errors,
          COUNT(*) FILTER (WHERE event_name = 'announcement_viewed') AS announcement_views
        FROM telemetry_events
        WHERE created_at BETWEEN date_from AND date_to
        GROUP BY date_trunc('day', created_at)
        ORDER BY day
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_telemetry_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Returns aggregated telemetry statistics for the admin dashboard. Only accessible to admin users. Does not expose raw event data.';

-- ============================================================================
-- 8. GRANT EXECUTE PERMISSION
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_telemetry_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) 
  TO authenticated;

-- ============================================================================
-- 9. ENABLE REALTIME (Optional - for live dashboard updates)
-- ============================================================================

-- Note: Enable only if live dashboard updates are needed
-- This can increase database load

-- ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry_events;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✓ telemetry_events table created
-- ✓ Indexes created for performance
-- ✓ RLS policies: users insert own, admins read all, service_role full
-- ✓ GDPR anonymization trigger on user deletion
-- ✓ Dashboard aggregate function (secure, admin-only)
--
-- Next steps:
-- 1. Deploy flush-telemetry Edge Function
-- 2. Update frontend telemetry.ts client
-- 3. Instrument forms with tracking calls
