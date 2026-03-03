-- Add reminder_days to certification_types: which intervals (30, 14, 7 days) trigger expiry reminders.
-- cert-expiry-reminders Edge Function only sends when the cert type has that day in reminder_days.

ALTER TABLE public.certification_types
  ADD COLUMN IF NOT EXISTS reminder_days integer[] DEFAULT '{}';

COMMENT ON COLUMN public.certification_types.reminder_days IS
  'Days before expiry to send reminder (e.g. [30, 14, 7]). Empty or null = no reminders.';
