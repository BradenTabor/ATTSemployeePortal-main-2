-- =============================================================================
-- Retrospective compliance record for the 2026-03-04 STOP from +18703656644.
--
-- Why this exists: ClickSend's message history retains roughly four months. The
-- oldest record retrievable on the account today (2026-09-09) is dated
-- 2026-05-11T10:40:03Z, and /v3/sms/inbound returns zero rows, so the original
-- inbound STOP has aged out. The only surviving evidence is the Opt-Out List
-- contact entry (list 3406168, contact 1548059062, date_added 1772664697 =
-- 2026-03-04T22:51:37Z) — a provider-side record that a dashboard click can
-- destroy. This row moves that evidence somewhere we control and back up.
--
-- Inert by construction: no app_users flag is touched, applied_* are both false,
-- and nothing in the codebase or the database reads sms_opt_out_events to drive
-- behaviour. Verified 2026-09-09 — see docs/sms-upgrade/03-SESSION-LOG.md.
-- Additive only, idempotent, no schema change.
-- =============================================================================

INSERT INTO public.sms_opt_out_events (
  phone_e164,
  user_id,
  keyword,
  raw_message,
  provider_message_id,
  source,
  applied_operational,
  applied_marketing,
  received_at
)
SELECT
  '+18703656644',
  'c1d477de-3b80-433e-9fed-7ff03082f608'::uuid,
  'STOP',
  'RETROSPECTIVE RECORD — reconstructed 2026-09-09, not a live inbound event. '
  || 'Source of truth: ClickSend Opt-Out List (list_id 3406168, contact_id 1548059062, '
  || 'date_added 1772664697 = 2026-03-04T22:51:37Z, contact email bradenleetabor@gmail.com). '
  || 'The original inbound message is no longer retrievable: ClickSend history retains ~4 months, '
  || 'the oldest record on the account is 2026-05-11T10:40:03Z, and /v3/sms/inbound returns 0 rows. '
  || 'The message body was never captured anywhere, so the wording of the STOP is unknown; '
  || 'the keyword is inferred from ClickSend having moved the number onto its Opt-Out List. '
  || 'No opt-out flag was changed on 2026-03-04 and none is changed by this row — '
  || 'applied_operational and applied_marketing are both false, and both app_users rows sharing '
  || 'this handset still read sms_operational_opt_out = false, sms_marketing_opt_out = false: '
  || 'admin c1d477de-3b80-433e-9fed-7ff03082f608 and employee 61d09ffe-75eb-45d1-a5f8-dac8b0bfdffd. '
  || 'user_id is set to the admin account because the ClickSend contact email matches it; '
  || 'the employee account is named here because one uuid column cannot hold both.',
  NULL,
  'admin_manual',
  false,
  false,
  '2026-03-04T22:51:37Z'::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM public.sms_opt_out_events
  WHERE phone_e164 = '+18703656644'
    AND source = 'admin_manual'
    AND received_at = '2026-03-04T22:51:37Z'::timestamptz
);
