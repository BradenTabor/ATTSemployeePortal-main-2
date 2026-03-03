-- escalation_hours: per cert type, hours after submitted_at before escalating to admins.
-- last_escalated_at: on attempts (throttle per attempt) and on records (throttle per record if used).

ALTER TABLE public.certification_types
  ADD COLUMN IF NOT EXISTS escalation_hours integer NOT NULL DEFAULT 48;

COMMENT ON COLUMN public.certification_types.escalation_hours IS
  'Hours after a test is submitted before escalating to admins (awaiting review). Default 48.';

ALTER TABLE public.certification_attempts
  ADD COLUMN IF NOT EXISTS last_escalated_at timestamptz;

COMMENT ON COLUMN public.certification_attempts.last_escalated_at IS
  'When this attempt was last included in an admin escalation. Only re-escalate if null or older than 24h.';

ALTER TABLE public.certification_records
  ADD COLUMN IF NOT EXISTS last_escalated_at timestamptz;

COMMENT ON COLUMN public.certification_records.last_escalated_at IS
  'When this record was last included in an admin escalation. Only re-escalate if null or older than 24h.';
