# Hard guard against retention deleting the opt-out audit trail — assessment

**Status:** assessment only, written 2026-09-09. **Nothing in this document is applied.** The
three guards that *were* applied are in migration `20260909220000_sms_retention_protection.sql`
(table comments, a `notes` column, an explicit `enabled = false` policy row). This document
covers the fourth thing that was asked about and deliberately not built: a hard guard inside
`run_data_retention()` itself.

**Recommendation: against modifying `run_data_retention()`. For a `BEFORE INSERT OR UPDATE`
trigger on `data_retention_policies` instead.** Reasoning below, then the diff.

---

## What `run_data_retention()` actually does with `enabled = false`

Read from production, not inferred. The function's driving cursor is:

```sql
FOR pol IN
  SELECT p.table_name, p.date_column, p.retention_days, p.archive_table_name
  FROM public.data_retention_policies p
  WHERE p.enabled
    AND EXISTS (... table exists ...)
    AND EXISTS (... date_column exists ...)
LOOP
```

`WHERE p.enabled` is applied at the cursor, so a disabled policy is never entered into the loop
at all. It produces **no delete, no `safety_audit_log` row, no archive copy, and no output row** —
the function's return set has one row per *processed* policy, so a disabled table is simply absent
from the result rather than reported as zero. Verified by running that exact predicate read-only
against production on 2026-09-09: eight policy rows exist, seven come back, `sms_opt_out_events`
does not.

That is the good news and also the limit of what the disabled row buys. It is a **no-op marker**.
It stops nothing; it only records intent, and it is one `UPDATE ... SET enabled = true` away from
being a live deletion policy.

---

## The failure mode the disabled row does *not* close

Every existing retention migration in this repo uses the same shape:

```sql
INSERT INTO public.data_retention_policies (table_name, date_column, retention_days, enabled)
VALUES ('safety_incidents', 'incident_date', 1825, true)
ON CONFLICT (table_name) DO UPDATE SET
  date_column = EXCLUDED.date_column,
  retention_days = EXCLUDED.retention_days,
  enabled = EXCLUDED.enabled,
  updated_at = now();
```

Copy-paste that for `sms_opt_out_events` and the `ON CONFLICT DO UPDATE` **overwrites the disabled
row**: `enabled` flips to true, and `retention_days` overwrites the ~999-year backstop with
whatever the new row carries. The `notes` column is not in the `EXCLUDED` list, so the reason
survives — but it survives attached to a policy that is now live and deleting, which is worse than
useless. The `UNIQUE (table_name)` constraint does not help either, because the whole point of
`ON CONFLICT` is to swallow it.

So the honest assessment of what shipped: comments and a disabled row raise the odds that someone
*reads* the warning, and they make the absence of retention legible in `SELECT * FROM
data_retention_policies`. They do not make the deletion impossible. A hard guard is a real gap,
not a belt-and-braces nicety.

---

## Why not inside `run_data_retention()`

**1. The repo cannot currently reproduce the live function body, so any `CREATE OR REPLACE`
written from the migration files silently regresses production.** Two migrations define this
function:

| Migration | Body it installs |
|---|---|
| `20260216100003_retention_audit_trail.sql` | Rich: counts rows first, writes a `data_retention_delete` row to `safety_audit_log` **before** deleting, honours `archive_table_name` by copying rows into an archive table first |
| `20260229150000_data_retention_policies.sql` | Simple: bare `DELETE`, no audit row, no archive support |

`20260216100003` sorts **before** `20260229150000`, so a clean forward replay ends on the simple
body. Production runs the **rich** body. Whoever writes the guard will naturally open
`20260229150000_data_retention_policies.sql` — it is the file named after the feature — copy that
body, add the guard, and ship a `CREATE OR REPLACE` that removes the retention audit trail and
archive support from a nightly job, in a migration whose stated purpose is *improving* retention
safety. That is a specific, likely, silent regression, and it is the single strongest argument
here.

**2. Seven live policies depend on this function nightly.** `dvir_reports`, `daily_jsa`,
`daily_equipment_inspections`, `safety_incidents` (OSHA 1904.33, 5 years),
`user_activity_sessions`, `telemetry_events`, `notification_outbox`. It runs as
`SECURITY DEFINER` under cron `run-data-retention` (`0 3 * * *`, active). A syntax-level mistake
inside the loop takes out OSHA-mandated retention along with everything else, and it fails at
03:00 with no one watching — the same asynchronous-cron-failure mode already recorded for
`cron_http_failures` in Session 7. The blast radius of editing this function is every compliance
table in the system; the blast radius of the problem being solved is one SMS table.

**3. A hardcoded table list inside the function is a second source of truth that will drift.**
`data_retention_policies` is the declared source of truth for which tables have retention. A
protected-table array inside the function body is a competing register that lives in a place
nobody looks, updated by a different kind of change (function replacement) than the one that adds
protection today (a comment plus a policy row). The next protected table gets the comment and the
disabled row and not the array entry — and by then people believe the function guards them, which
is a worse position than believing nothing guards them.

**4. It guards at the wrong moment.** A guard inside the function discovers the mistake at 03:00,
hours or days after the migration that caused it landed and was reviewed as fine. Loud logging
helps only if someone reads `safety_audit_log` or the cron output, and the entire reason this
hazard exists is that nobody was reading anything.

---

## The alternative, and why it is better on every axis above

Guard at the point of the mistake: a `BEFORE INSERT OR UPDATE` trigger on
`data_retention_policies` that refuses to let a protected table become `enabled`.

- It fails **at migration time**, in the transaction that made the mistake, with a message the
  author reads immediately — not at 03:00 in a log nobody opens.
- It touches **nothing** the seven other tables depend on. `run_data_retention()` is not
  modified, so the audit-trail/archive regression in point 1 cannot happen.
- The protected list still lives outside `data_retention_policies`, so point 3's drift argument
  applies in weakened form — but it lives on the table it protects, which is where someone editing
  policies will actually encounter it, and the failure mode of a stale list is "a new table is
  unguarded", not "a guarded table is quietly unguarded".
- It closes the `ON CONFLICT DO UPDATE` hole specifically, which is the realistic path in.

Costs, stated honestly: it adds a trigger to a table that had none, so a legitimate future decision
to retain opt-out events (there isn't one today — TCPA guidance is 5 years minimum and this table
holds records with no other surviving copy) requires dropping or amending the trigger rather than
flipping a boolean. That is the intended friction, but it is friction, and it should be a
deliberate choice rather than a surprise. The `EXCEPTION` message names the escape hatch so the
person hitting it is not stuck.

### Diff — not applied

Would be `supabase/migrations/<later-timestamp>_retention_protected_tables_guard.sql`:

```sql
-- Refuse to enable a retention policy on a table whose oldest rows are its most
-- evidentially valuable. Guards at write time, in the transaction that made the
-- mistake — not at 03:00 in run_data_retention(), which is deliberately left alone
-- because seven other compliance tables depend on it nightly and the repo's two
-- competing definitions of it mean any CREATE OR REPLACE risks a silent regression.
-- See docs/sms-upgrade/16-RETENTION-GUARD-ASSESSMENT.md.

CREATE OR REPLACE FUNCTION public.guard_retention_protected_tables()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  protected constant text[] := ARRAY['sms_opt_out_events'];
BEGIN
  IF NEW.enabled AND NEW.table_name = ANY (protected) THEN
    RAISE EXCEPTION
      'Retention cannot be enabled on protected table %. Its received_at values are '
      'backdated to real event times, so oldest-first deletion destroys the most '
      'evidentially valuable records first. TCPA opt-out documentation is 5 years '
      'minimum. If this is genuinely intended, amend '
      'public.guard_retention_protected_tables() in the same migration and record why. '
      'See docs/sms-upgrade/16-RETENTION-GUARD-ASSESSMENT.md.',
      NEW.table_name
      USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_retention_protected_tables
  ON public.data_retention_policies;

CREATE TRIGGER guard_retention_protected_tables
  BEFORE INSERT OR UPDATE ON public.data_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_retention_protected_tables();
```

Note it deliberately allows the `enabled = false` row to be inserted and updated freely — the
marker row from `20260909220000` must stay writable, and only `enabled = true` is refused.

### If someone later does want the in-function guard anyway

Then the prerequisite is not the guard. It is reconciling the two competing definitions of
`run_data_retention()` so the repo can reproduce the live body — dump
`pg_get_functiondef('public.run_data_retention'::regproc)` from production, commit it as the
current definition in a new migration, confirm a forward replay lands on it, and only then edit.
That is its own task with its own review, and it is worth doing on its own merits regardless of
whether any guard is ever added.
