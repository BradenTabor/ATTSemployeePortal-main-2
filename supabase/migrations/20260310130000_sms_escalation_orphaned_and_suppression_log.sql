-- =============================================================================
-- SMS Escalation: orphaned_user_ids and suppression_log for send_log
-- Supports dynamic tier 1: log users with no manager / no manager phone (routed to tier 2).
-- Verbose suppression: log users excluded by absences, dates skipped by calendar.
-- =============================================================================

ALTER TABLE public.sms_escalation_send_log
  ADD COLUMN IF NOT EXISTS orphaned_user_ids jsonb DEFAULT '[]';

COMMENT ON COLUMN public.sms_escalation_send_log.orphaned_user_ids IS
  'Tier 1: array of { user_id, reason } for users routed to tier 2 (no manager or manager has no phone). Empty for tier 0/2.';

ALTER TABLE public.sms_escalation_send_log
  ADD COLUMN IF NOT EXISTS suppression_log jsonb DEFAULT '{}';

COMMENT ON COLUMN public.sms_escalation_send_log.suppression_log IS
  'Verbose log: { dates_skipped_calendar: string[], users_excluded_absences: number|string[], overdue_before: number, overdue_after: number }. Used to verify calendar/absence exclusions.';
