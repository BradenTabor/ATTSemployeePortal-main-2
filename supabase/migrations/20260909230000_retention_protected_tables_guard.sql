-- =============================================================================
-- Hard guard: refuse retention policies on tables whose oldest rows are their
-- most evidentially valuable.
--
-- Guards at WRITE TIME, in the transaction that made the mistake — not at 03:00
-- inside run_data_retention(), which is deliberately left alone. Two reasons,
-- both recorded in docs/sms-upgrade/16-RETENTION-GUARD-ASSESSMENT.md:
--   1. Seven live compliance policies (including safety_incidents, OSHA 1904.33,
--      5 years) depend on that function nightly, so its blast radius is every
--      compliance table in the system while the problem is one SMS table.
--   2. The repo holds two competing definitions of run_data_retention() and a
--      clean replay lands on the wrong one, so any CREATE OR REPLACE written
--      from the migration files risks silently regressing production. See the
--      KNOWN-ISSUES.md entry "Two migrations define run_data_retention()".
--
-- What this closes that 20260909220000 did not. Every retention migration in
-- this repo uses INSERT ... ON CONFLICT (table_name) DO UPDATE SET enabled =
-- EXCLUDED.enabled. Copy-pasting that shape for sms_opt_out_events overwrites
-- the deliberately-disabled marker row from 20260909220000: enabled flips to
-- true and retention_days overwrites the ~999-year backstop. notes is not in
-- the EXCLUDED list, so the warning text survives — attached to a policy that
-- is now live and deleting, which is worse than no warning at all.
--
-- Additive only. No change to run_data_retention(), no change to either SMS
-- table, no data rewrite. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Two registers, deliberately different in strength.
--
-- PROHIBITED (sms_opt_out_events): no policy row may be inserted or updated at
--   all, regardless of enabled. Blocking only enabled = true would leave the
--   ON CONFLICT DO UPDATE hole open, because that statement's BEFORE INSERT
--   pass carries whatever enabled value the copy-paste brought with it and the
--   conflicting UPDATE is where the flip actually happens. Blocking the whole
--   row is the only formulation that closes both halves. Matches the table's
--   own COMMENT, which says "Do not enable it" without qualification.
--
-- SIGN-OFF REQUIRED (sms_message_log): an enabled policy is permitted, but only
--   in the shape the table's COMMENT already requires — archive_table_name set
--   rather than deleting outright, and a reason recorded in notes. This is
--   deliberately NOT the prohibited list. That comment permits a policy with
--   legal/HR sign-off, so an outright block would forbid what the documented
--   process allows, and a guard that contradicts its own documentation gets
--   dropped the first time someone follows the process. A guard that is dropped
--   protects nothing. What is enforced here is only the mechanically checkable
--   half of that comment; sign-off itself is not expressible in SQL. The shape
--   this rejects is exactly the four-column copy-paste every other retention
--   migration uses, which is the realistic accident.
--
-- DELETE is deliberately not guarded. Removing the marker row loses the record
-- of the decision but not the protection: a table with no policy is never
-- entered into run_data_retention()'s loop. DELETE is also not a bypass, because
-- the follow-up INSERT is refused here.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_retention_protected_tables()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prohibited constant text[] := ARRAY['sms_opt_out_events'];
  signoff_required constant text[] := ARRAY['sms_message_log'];
  offending text;
BEGIN
  -- On UPDATE, check the row's previous table_name too, so a policy cannot be
  -- moved off a protected table (which would silently discard the marker row).
  offending := CASE
    WHEN NEW.table_name = ANY (prohibited) THEN NEW.table_name
    WHEN TG_OP = 'UPDATE' AND OLD.table_name = ANY (prohibited) THEN OLD.table_name
    ELSE NULL
  END;

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'data_retention_policies: "%" is retention-protected; % refused', offending, TG_OP
      USING
        ERRCODE = 'raise_exception',
        DETAIL  = format(
          'Read the reason before changing this. It is on the table itself: '
          || 'SELECT obj_description(''public.%I''::regclass); (or \d+ public.%I in psql). '
          || 'Short version: received_at on that table is deliberately backdated to the real '
          || 'time each recipient asked to stop, so run_data_retention() deletes oldest-first '
          || 'and would take the most evidentially valuable rows first — starting with the '
          || '2026-03-04 STOP whose only other copy is a provider-side list entry a dashboard '
          || 'click can destroy. TCPA opt-out recordkeeping is 5 years minimum.',
          offending, offending
        ),
        HINT    = 'The enabled = false marker row already in this table is the intended state; '
          || 'it records that the absence of retention here is a decision, not an oversight. '
          || 'If retention on this table is genuinely intended, amend '
          || 'public.guard_retention_protected_tables() in the same migration and write down why. '
          || 'Background: docs/sms-upgrade/16-RETENTION-GUARD-ASSESSMENT.md.';
  END IF;

  IF NEW.enabled AND NEW.table_name = ANY (signoff_required)
     AND (
       NEW.archive_table_name IS NULL
       OR btrim(NEW.archive_table_name) = ''
       OR NEW.notes IS NULL
       OR btrim(NEW.notes) = ''
     )
  THEN
    RAISE EXCEPTION
      'data_retention_policies: "%" requires archive_table_name and notes before retention can be enabled',
      NEW.table_name
      USING
        ERRCODE = 'raise_exception',
        DETAIL  = format(
          'This table is not prohibited from having a retention policy, but its COMMENT sets '
          || 'conditions and this row does not meet them. Read it: '
          || 'SELECT obj_description(''public.%I''::regclass);. It requires legal/HR sign-off, '
          || 'archive_table_name set rather than deleting outright, and the reason recorded in '
          || 'the notes column. Rows deleted from this table stop being available to the SMS '
          || 'Communications compliance export, and a send to someone who had opted out is not '
          || 'a routine send log — it is the evidence of the violation.',
          NEW.table_name
        ),
        HINT    = 'Set archive_table_name (e.g. sms_message_log_archive) and write the sign-off '
          || 'reference into notes. Sign-off itself cannot be checked here, so this only '
          || 'enforces the mechanically checkable half of that COMMENT.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_retention_protected_tables() IS
  'BEFORE INSERT OR UPDATE guard on data_retention_policies. Refuses any policy row for '
  'sms_opt_out_events outright, and refuses an enabled policy for sms_message_log unless '
  'archive_table_name and notes are set. Fails in the transaction that made the mistake rather '
  'than at 03:00 in run_data_retention(). See docs/sms-upgrade/16-RETENTION-GUARD-ASSESSMENT.md.';

DROP TRIGGER IF EXISTS guard_retention_protected_tables
  ON public.data_retention_policies;

CREATE TRIGGER guard_retention_protected_tables
  BEFORE INSERT OR UPDATE ON public.data_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_retention_protected_tables();

-- -----------------------------------------------------------------------------
-- Replay note, stated so it is not discovered as a surprise.
--
-- This migration sorts after 20260909220000, so a clean forward replay inserts
-- the marker row before the trigger exists and is unaffected. Re-running
-- 20260909220000 on its own against a database that already has both the marker
-- row and this trigger will now fail: BEFORE INSERT fires before ON CONFLICT is
-- evaluated, so its no-op DO NOTHING insert is refused rather than ignored.
-- That is not a workflow here — supabase/.localgate/run.sh drops and recreates
-- the gate database on every run — but it is real, and the fix if it is ever
-- needed is to drop this trigger for the duration rather than to weaken it.
-- -----------------------------------------------------------------------------
