-- =============================================================================
-- One-time setup: send next Tier 2 escalation SMS only to Braden Tabor (test)
-- Run in Supabase Dashboard → SQL Editor BEFORE running send-escalation-sms-test.sh
-- =============================================================================
-- After you receive the SMS, run the "Restore" block at the bottom.

-- 1) See current Tier 2 recipients (identify Braden by label or phone_e164)
SELECT id, phone_e164, label, is_active, sort_order
FROM sms_escalation_recipients
WHERE tier = 2
ORDER BY sort_order;

-- 2) Deactivate all Tier 2 recipients
UPDATE sms_escalation_recipients
SET is_active = false
WHERE tier = 2;

-- 3) Activate only Braden Tabor (match by label; adjust if your label differs)
UPDATE sms_escalation_recipients
SET is_active = true
WHERE tier = 2
  AND (label ILIKE '%braden%' OR label ILIKE '%tabor%');

-- If no label matches, activate by phone (replace with Braden's E.164):
-- UPDATE sms_escalation_recipients SET is_active = true WHERE tier = 2 AND phone_e164 = '+1XXXXXXXXXX';

-- 4) Remove today's Tier 2 send log so the next run is not blocked by idempotency
DELETE FROM sms_escalation_send_log
WHERE tier = 2
  AND (sent_at AT TIME ZONE 'America/Chicago')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date;

-- Verify: only one active Tier 2 recipient
SELECT id, phone_e164, label, is_active FROM sms_escalation_recipients WHERE tier = 2;

-- =============================================================================
-- RESTORE (run after you receive the test SMS)
-- =============================================================================
-- UPDATE sms_escalation_recipients SET is_active = true WHERE tier = 2;
