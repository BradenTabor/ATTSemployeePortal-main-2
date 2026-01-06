-- ============================================
-- Notification System Tables
-- ============================================
-- This migration creates the tables needed for the push notification system:
-- - notification_events: Stores notification events created by admins
-- - notification_outbox: Queue of pending notifications per user
-- - push_subscriptions: Web Push subscription storage
-- - notification_preferences: User preferences per category

-- ============================================
-- 1. notification_events
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Event classification
  category TEXT NOT NULL CHECK (category IN ('schedule', 'announcement', 'safety_alert', 'job_update', 'rto_decision', 'admin_notice')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Targeting
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'role', 'crew', 'user')),
  target_ref TEXT,  -- role name, job_id for crew, or user_id
  
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  
  -- Metadata
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID,  -- Future: multi-org support
  
  -- Entity pointers (optional)
  entity_type TEXT,  -- 'job', 'rto', 'announcement', etc.
  entity_id UUID
);

CREATE INDEX IF NOT EXISTS idx_notification_events_category ON public.notification_events(category, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_events_target ON public.notification_events(target_type, target_ref);
CREATE INDEX IF NOT EXISTS idx_notification_events_created ON public.notification_events(created_at DESC);

-- ============================================
-- 2. notification_outbox
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Delivery config (denormalized from event + preferences)
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,  -- Future
  
  -- Delivery state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  last_error TEXT,
  
  -- Content (denormalized for resilience)
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  
  -- Deduplication
  dedupe_key TEXT UNIQUE NOT NULL,  -- Format: "event:{event_id}:user:{user_id}"
  
  -- Scheduling (for quiet hours)
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON public.notification_outbox(status, scheduled_for)
  WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_notification_outbox_user ON public.notification_outbox(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_event ON public.notification_outbox(event_id);

-- ============================================
-- 3. push_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Web Push subscription details
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  
  -- Metadata
  user_agent TEXT,
  revoked_at TIMESTAMPTZ,
  
  -- Support multiple devices per user
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(revoked_at)
  WHERE revoked_at IS NULL;

-- ============================================
-- 4. notification_preferences
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Preferences
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Quiet hours (JSONB for timezone support)
  quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00", "timezone": "America/New_York"}'::jsonb,
  
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON public.notification_preferences(user_id);

-- ============================================
-- 5. RLS Policies
-- ============================================

-- notification_events: Admins can CRUD, others can read their relevant events
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access events" ON public.notification_events;
CREATE POLICY "Admins full access events" ON public.notification_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role full access events" ON public.notification_events;
CREATE POLICY "Service role full access events" ON public.notification_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- notification_outbox: Users see their own, admins see all
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own outbox" ON public.notification_outbox;
CREATE POLICY "Users read own outbox" ON public.notification_outbox
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins full access outbox" ON public.notification_outbox;
CREATE POLICY "Admins full access outbox" ON public.notification_outbox
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role full access outbox" ON public.notification_outbox;
CREATE POLICY "Service role full access outbox" ON public.notification_outbox
  FOR ALL
  USING (auth.role() = 'service_role');

-- push_subscriptions: Users manage their own
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions
  FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access subscriptions" ON public.push_subscriptions;
CREATE POLICY "Service role full access subscriptions" ON public.push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- notification_preferences: Users manage their own
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own preferences" ON public.notification_preferences
  FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access preferences" ON public.notification_preferences;
CREATE POLICY "Service role full access preferences" ON public.notification_preferences
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function to atomically claim pending notifications for processing
-- Used by the notifications-worker Edge Function
CREATE OR REPLACE FUNCTION public.claim_pending_notifications(batch_size INT DEFAULT 100)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  user_id UUID,
  title TEXT,
  body TEXT,
  url TEXT,
  category TEXT,
  severity TEXT,
  attempts INT,
  max_attempts INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_outbox
  SET status = 'processing'
  WHERE notification_outbox.id IN (
    SELECT outbox.id FROM public.notification_outbox outbox
    WHERE outbox.status IN ('pending', 'failed')
      AND outbox.scheduled_for <= NOW()
      AND outbox.attempts < outbox.max_attempts
    ORDER BY outbox.created_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    notification_outbox.id,
    notification_outbox.event_id,
    notification_outbox.user_id,
    notification_outbox.title,
    notification_outbox.body,
    notification_outbox.url,
    notification_outbox.category,
    notification_outbox.severity,
    notification_outbox.attempts,
    notification_outbox.max_attempts;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.claim_pending_notifications(INT) TO service_role;

-- ============================================
-- 7. Auto-create default preferences for new users
-- ============================================
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
DECLARE
  cats TEXT[] := ARRAY['schedule', 'announcement', 'safety_alert', 'job_update', 'rto_decision', 'admin_notice'];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    INSERT INTO public.notification_preferences (user_id, category)
    VALUES (NEW.id, cat)
    ON CONFLICT (user_id, category) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if it doesn't exist)
DROP TRIGGER IF EXISTS on_user_created_create_notification_prefs ON auth.users;
CREATE TRIGGER on_user_created_create_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_preferences();

-- ============================================
-- 8. Update timestamp trigger for preferences
-- ============================================
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

