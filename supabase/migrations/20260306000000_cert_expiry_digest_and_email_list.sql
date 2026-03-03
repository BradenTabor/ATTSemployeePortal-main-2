-- Certification expiry digest: new notification category and email list key.
-- Digest goes to admins/safety_officer; separate category so admins can mute digest
-- without muting their own cert_expiry reminders.
-- New enum value cannot be used in same transaction; seed in same file after commit.

-- 1. Add certification_expiry_digest to notification_events.category
ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_category_check;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_category_check
  CHECK (category IN (
    'schedule', 'announcement', 'safety_alert', 'job_update',
    'rto_decision', 'admin_notice', 'certification_expiry', 'certification_expiry_digest'
  ));

-- 2. Add certification_expiry_digest to email_list_key (cannot use in same transaction)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'certification_expiry_digest'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_list_key')
  ) THEN
    ALTER TYPE public.email_list_key ADD VALUE 'certification_expiry_digest';
  END IF;
END;
$$;
