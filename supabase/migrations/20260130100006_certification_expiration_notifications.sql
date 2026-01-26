-- =============================================================================
-- Certification Expiration Notifications
-- =============================================================================
-- Table for idempotent 30/14/7/0-day reminders. Add certification_expiry to
-- notification_events.category.
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS public.certification_expiration_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_record_id UUID NOT NULL REFERENCES public.certification_records(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('30_day', '14_day', '7_day', 'expired')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(certification_record_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_cert_expiration_notif_scheduled
  ON public.certification_expiration_notifications(scheduled_for)
  WHERE sent_at IS NULL;

COMMENT ON TABLE public.certification_expiration_notifications IS
  'Idempotent log of expiration reminders. Cron creates notification_events and marks sent here.';

ALTER TABLE public.certification_expiration_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cert_expiration_notif_admin_select" ON public.certification_expiration_notifications;
CREATE POLICY "cert_expiration_notif_admin_select"
  ON public.certification_expiration_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  );

-- Add certification_expiry to notification_events.category
ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_category_check;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_category_check
  CHECK (category IN (
    'schedule', 'announcement', 'safety_alert', 'job_update',
    'rto_decision', 'admin_notice', 'certification_expiry'
  ));
