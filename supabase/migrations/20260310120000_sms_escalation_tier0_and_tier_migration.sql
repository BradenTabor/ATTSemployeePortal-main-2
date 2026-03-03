-- =============================================================================
-- SMS Escalation: Tier 0 (employee reminders) + Tier 1 → Tier 2 migration
-- Phase 1 of 10x upgrade. Extends send_log/recipients to support tier 0;
-- repurposes tier 1 to dynamic supervisor (manager_id); migrates existing
-- tier-1 static recipients to tier 2.
-- =============================================================================

-- 1. Extend tier CHECK to support tier 0 (employee reminders)
ALTER TABLE public.sms_escalation_send_log
  DROP CONSTRAINT IF EXISTS sms_escalation_send_log_tier_check;
ALTER TABLE public.sms_escalation_send_log
  ADD CONSTRAINT sms_escalation_send_log_tier_check CHECK (tier IN (0, 1, 2));

-- 2. Migrate existing tier-1 static recipients to tier 2
-- Tier 1 is repurposed to "dynamic supervisor via app_users.manager_id".
-- Existing tier-1 rows are admin contacts → tier 2 (persistent non-compliance).
UPDATE public.sms_escalation_recipients
  SET tier = 2
  WHERE tier = 1;

-- 3. Extend recipients table tier CHECK to support tier 0
ALTER TABLE public.sms_escalation_recipients
  DROP CONSTRAINT IF EXISTS sms_escalation_recipients_tier_check;
ALTER TABLE public.sms_escalation_recipients
  ADD CONSTRAINT sms_escalation_recipients_tier_check CHECK (tier IN (0, 1, 2));

-- 4. Add employee_user_ids column to send_log for tier-0 per-employee tracking
ALTER TABLE public.sms_escalation_send_log
  ADD COLUMN IF NOT EXISTS employee_user_ids uuid[] DEFAULT '{}';

COMMENT ON COLUMN public.sms_escalation_send_log.employee_user_ids IS
  'For tier 0: array of user_ids who were sent reminders. Empty for tier 1/2. Phase 3 may deprecate once sms_escalation_send_recipients is populated at send time.';
