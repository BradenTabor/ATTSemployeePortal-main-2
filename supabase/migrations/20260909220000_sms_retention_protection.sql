-- =============================================================================
-- Protect the SMS opt-out audit trail from run_data_retention().
--
-- run_data_retention() is not a per-table function. It is a generic loop over
-- data_retention_policies that deletes every row older than retention_days from
-- whatever table is listed, oldest-first, at 03:00 daily. Nothing about it knows
-- that sms_opt_out_events holds the only surviving copy of a 2026-03-04 STOP
-- whose received_at is deliberately backdated to the real event time.
--
-- Adding a policy for that table would therefore destroy the most evidentially
-- valuable rows first. Three additive guards, in increasing order of loudness:
--   1. Table comments, so \d+ and every schema browser carries the warning.
--   2. A notes column on data_retention_policies, so a reason can be recorded.
--   3. An explicit enabled = false policy row with that reason, so the absence
--      of a policy reads as a decision rather than an oversight.
--
-- Additive only, idempotent. No schema change to either SMS table, no data
-- rewrite, no change to run_data_retention() itself.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table comments
-- -----------------------------------------------------------------------------

COMMENT ON TABLE public.sms_opt_out_events IS
  'Audit trail for inbound STOP/START/HELP and reconciliation-driven opt-out changes. '
  'DO NOT ADD THIS TABLE TO data_retention_policies. run_data_retention() deletes '
  'oldest-first by date_column, and received_at here is intentionally backdated to the '
  'real time the recipient asked to stop — not the time the row was written. The oldest '
  'rows are the most evidentially valuable, so an ordinary retention policy would delete '
  'exactly the records a TCPA allegation turns on, starting with the 2026-03-04 STOP whose '
  'only other copy is a provider-side list entry a dashboard click can destroy. '
  'TCPA recordkeeping guidance for opt-out documentation is 5 years minimum '
  '(11-COMPLIANCE-SOP.md 5.7); this table is where that clock is kept. '
  'An explicit enabled = false row exists in data_retention_policies for this table so the '
  'absence of retention is legible as a decision. Do not enable it.';

COMMENT ON TABLE public.sms_message_log IS
  'Unified per-recipient outbound SMS send log. Source of sms_message_log_compat, which is the '
  'source of the SMS Communications compliance export handed to auditors. '
  'RETENTION IS A DELIBERATE DECISION HERE, NOT A DEFAULT: 11-COMPLIANCE-SOP.md 5.7 proposes '
  '2 years for routine send logs, but any row deleted stops being available to that export, '
  'and a send to someone who had opted out is not a routine send log — it is the evidence of '
  'the violation. Before adding this table to data_retention_policies, confirm with legal/HR '
  'sign-off, set archive_table_name rather than deleting outright, and record the reason in '
  'the policy notes column. Related and stricter: sms_opt_out_events must never be added at all.';

-- -----------------------------------------------------------------------------
-- 2. A place to record why a policy exists, or why it is deliberately disabled
-- -----------------------------------------------------------------------------

ALTER TABLE public.data_retention_policies
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.data_retention_policies.notes IS
  'Why this policy exists, or — for enabled = false rows — why retention is deliberately not '
  'applied to this table. run_data_retention() does not read this column; it is for the next '
  'person to read before changing the row.';

-- -----------------------------------------------------------------------------
-- 3. Explicit disabled policy for sms_opt_out_events
--
-- retention_days is NOT NULL, so a value is required even though the row is
-- disabled. 365000 (~999 years) is chosen as a second line of defence: if someone
-- flips enabled to true without reading the notes, the cutoff lands in the 11th
-- century and the DELETE matches nothing. It stays inside Postgres's date range,
-- unlike a larger figure, so the function errors on nothing.
--
-- ON CONFLICT DO NOTHING, not DO UPDATE: if a future row already exists here it
-- was put there by a human decision, and this migration must not silently
-- overwrite it on replay.
-- -----------------------------------------------------------------------------

INSERT INTO public.data_retention_policies
  (table_name, date_column, retention_days, enabled, notes)
VALUES (
  'sms_opt_out_events',
  'received_at',
  365000,
  false,
  'DELIBERATELY DISABLED — DO NOT ENABLE. This row exists so the absence of retention on '
  || 'sms_opt_out_events reads as a decision rather than an oversight. Opt-out records are the '
  || 'evidence that a recipient asked to stop and when; TCPA guidance is 5 years minimum '
  || '(11-COMPLIANCE-SOP.md 5.7) and this table holds records with no other surviving copy. '
  || 'received_at is intentionally backdated to the real event time, so run_data_retention()''s '
  || 'oldest-first deletion would take the most valuable rows first. retention_days is set to '
  || '~999 years as a backstop in case enabled is flipped without reading this. '
  || 'Rationale: docs/sms-upgrade/03-SESSION-LOG.md, Session 12.'
)
ON CONFLICT (table_name) DO NOTHING;
