-- =============================================================================
-- Kill switch for send-path operational opt-out enforcement.
--
-- ClickSend's opt-out list is only consulted for list-addressed sends. Every
-- portal send is ad-hoc to a raw number, so the carrier is not a backstop and
-- app_users.sms_operational_opt_out must be enforced in the send paths
-- themselves (safety-briefing-reminder-sms, safety-briefing-escalation-sms;
-- payroll-hours-reminder-sms already enforced it).
--
-- Default ON. Set {"enabled": false} to disable in seconds without a redeploy.
-- Absent row also resolves to ON in the Edge Functions, so deleting this row
-- cannot silently turn consent enforcement off.
--
-- Additive only: seeds one app_settings row. No schema or data rewrites.
-- =============================================================================

INSERT INTO public.app_settings (key, value) VALUES
(
  'sms_send_optout_filter_config',
  '{"enabled": true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
