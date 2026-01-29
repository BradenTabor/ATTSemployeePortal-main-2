-- Phase 2: Optional Spanish content on notification events for per-user localization
-- notifications-dispatch uses preferred_language to set title/body per recipient.

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS body_es TEXT;

COMMENT ON COLUMN public.notification_events.title_es IS 'Spanish title; used when recipient preferred_language is es';
COMMENT ON COLUMN public.notification_events.body_es IS 'Spanish body; used when recipient preferred_language is es';
