-- Extend certification_expiration_notifications for external cert idempotency.
-- XOR constraint: each row references exactly one of certification_record_id OR external_certification_id.

ALTER TABLE public.certification_expiration_notifications
  ADD COLUMN IF NOT EXISTS external_certification_id UUID REFERENCES public.worker_external_certifications(id) ON DELETE CASCADE;

ALTER TABLE public.certification_expiration_notifications
  ALTER COLUMN certification_record_id DROP NOT NULL;

ALTER TABLE public.certification_expiration_notifications
  DROP CONSTRAINT IF EXISTS chk_one_cert_ref;

ALTER TABLE public.certification_expiration_notifications
  ADD CONSTRAINT chk_exactly_one_cert_ref CHECK (
    (certification_record_id IS NOT NULL AND external_certification_id IS NULL)
    OR (certification_record_id IS NULL AND external_certification_id IS NOT NULL)
  );

-- Unique constraint for external cert idempotency (per cert, per notification_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cert_exp_notif_external_uniq
  ON public.certification_expiration_notifications(external_certification_id, notification_type)
  WHERE external_certification_id IS NOT NULL;

-- Allow dynamic notification_type for external certs (e.g. 90_day, 60_day from reminder_days)
ALTER TABLE public.certification_expiration_notifications
  DROP CONSTRAINT IF EXISTS certification_expiration_notifications_notification_type_check;

ALTER TABLE public.certification_expiration_notifications
  ADD CONSTRAINT certification_expiration_notifications_notification_type_check
  CHECK (notification_type = 'expired' OR notification_type ~ '^\d+_day$');

COMMENT ON COLUMN public.certification_expiration_notifications.external_certification_id IS
  'Set for external cert expiry reminders; certification_record_id set for built-in certs. Exactly one must be set.';
