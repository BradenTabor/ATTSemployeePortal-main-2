-- Phase 2: Optional Spanish content for announcements (multi-language)
-- When present, push notifications use user's preferred_language to pick title/message.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS message_es TEXT;

COMMENT ON COLUMN public.announcements.title_es IS 'Spanish title for announcements; used when user preferred_language is es';
COMMENT ON COLUMN public.announcements.message_es IS 'Spanish message body; used when user preferred_language is es';
