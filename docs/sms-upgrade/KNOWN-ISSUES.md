# SMS upgrade — known issues (out of scope)

## Full migration replay fails on `20241205_job_tracker`

**Status:** Tracked separately from SMS work. Waived for Chunk 1–3 gates.

**What fails:** Running `supabase db reset` (or replaying all ~170 migrations from zero) errors on `supabase/migrations/20241205_job_tracker.sql` because it references `public.app_users` before that table is created by `20251102034653_create_app_users_table_and_trigger.sql`.

**Why it matters:** No environment can be stood up from migrations alone without a prod baseline or manual fix. Local validation uses `supabase/.localgate/` (prod schema baseline + forward migrations) instead.

**SMS impact:** None. Chunk 1–3 migrations (`20260902120000` … `20260909110000`) apply cleanly after the Sept 2 field-audit migrations via localgate forward replay (+11 verified in Session 2).

**Fix direction (separate task):** Reorder or split `20241205_job_tracker` so FKs to `app_users` are added in a later migration, or document baseline-only provisioning as the supported path.

---

## `supabase db push` blocked by remote/local migration history mismatch

**Status:** Documented 2026-09-09 (post Chunks 1–3 deploy). **Do not repair the full history in an SMS session.**

**Symptom:** `supabase db push` / `db push --dry-run` fails with:

`LegacyDbPushMissingLocalError: Remote migration versions not found in local migrations directory.`

**Root cause:** Production `supabase_migrations.schema_migrations` contains **24 remote-only version IDs** for June 2026 gamification / field-audit work that were applied under different timestamps than the filenames in this repo. Local has the parallel set under different version stamps (**20 local-only** files). Same logical work, divergent version keys — classic “applied via dashboard/MCP/CLI with a different clock than the committed migration filename” drift.

Remote-only examples (do not revert here): `20260608154819` … `20260608194206`, `20260627161112` … `20260628033929`.

Local-only examples (would try to apply on a naïve push): `20260608120000` … `20260608230400`, `20260627120000` … `20260627170000`.

**SMS impact at deploy:** Blocked applying `20260902200000` / `20260909100000` / `20260909110000` via `db push`. Workaround used: `npx supabase db query --linked -f <migration.sql>` then `supabase migration repair --status applied <versions>`. Those three SMS versions **are** present in `schema_migrations` (verified post-deploy); a future push will neither re-apply nor miss them — but push remains blocked until the June divergence is repaired as its own task.

**Fix direction (separate task):** Align version IDs (repair remote→match local filenames, or rename local files to match remote + `migration repair`), then confirm `db push --dry-run` is clean. Prefer a dedicated migration-history PR, not an SMS chunk.

---

## Two migrations define `run_data_retention()`, and a clean replay installs the wrong one

**Status:** Recorded 2026-09-09. **Nothing about this is SMS work** — it surfaced while assessing
where to put the opt-out retention guard (`16-RETENTION-GUARD-ASSESSMENT.md`), and it is more
serious than the question that found it. **Not fixed here, deliberately.** A fix rewrites a nightly
`SECURITY DEFINER` job that deletes from OSHA-mandated tables; that needs its own review, not a
paragraph at the end of an SMS session.

### The two files

| Migration | Body | What else the file does |
|---|---:|---|
| `20260216100003_retention_audit_trail.sql` | 85 lines | Nothing else. It exists only to add the audit trail and archive support. |
| `20260229150000_data_retention_policies.sql` | 33 lines | **Creates** `data_retention_policies`, seeds the first three policies, sets up RLS. This is the base feature migration. |

### Why replay order produces the wrong one

Migrations apply in lexicographic order of the version prefix, and `20260216100003` sorts **before**
`20260229150000`. So the base migration sorts *after* an enhancement written against it, and
`CREATE OR REPLACE FUNCTION` in the base file overwrites the enhanced body with the original. A
forward replay from zero therefore ends on the 33-line body.

The proximate cause is a hand-written timestamp: **`20260229` is not a real date** — 2026 is not a
leap year — so it was typed rather than generated, and it was typed thirteen days into the future
relative to a change that already depended on it.

### Production runs the *other* body

Verified two independent ways on 2026-09-09:

- `pg_get_functiondef('public.run_data_retention'::regproc)` against the linked project returns
  **2,975 characters** and contains both `safety_audit_log` and `archive_table_name`.
- The function body dumped into `supabase/.localgate/prod_schema.sql` (lines 7721–7818) is
  **byte-identical** to `20260216100003_retention_audit_trail.sql`, apart from `pg_dump` writing
  the dollar-quote tag as `$_$` instead of `$$`.

Both versions are present in `supabase_migrations.schema_migrations`
(`20260216100003 / retention_audit_trail`, `20260229150000 / data_retention_policies`). That table
has no applied-at column, so the order cannot be read directly — but production can only hold the
audit-trail body if `20260216100003` was applied **after** `20260229150000`, out of version order.
The state is the evidence; the mechanism (dashboard apply, manual re-run, out-of-order CLI push)
is not recoverable from what is in the database.

### What the replay version loses, concretely

Diff of the two bodies, stated as losses relative to what production actually runs:

1. **The audit row.** The production body counts the doomed rows first, then writes a
   `safety_audit_log` entry **before** deleting:
   `event_type = 'data_retention_delete'`, `table_name`, and a `payload_snapshot` carrying
   `records_deleted`, `date_range_start`, `date_range_end`, `retention_policy_days`, `executed_at`.
   The replay body writes nothing anywhere. After a deletion there is no record that it happened,
   how many rows went, or what date range they covered — and the rows themselves are gone, so the
   loss is unreconstructable.
2. **Archive support, entirely.** The replay body's driving cursor does not even
   `SELECT p.archive_table_name`, so the whole `IF archive_table_name IS NOT NULL` branch is
   absent: no `CREATE TABLE IF NOT EXISTS <archive> (LIKE <source> INCLUDING DEFAULTS)`, no
   `INSERT INTO <archive> SELECT * FROM <source> WHERE …` before the `DELETE`. A policy that sets
   `archive_table_name` would be silently downgraded to a hard delete — the column would still be
   there, still settable, still read by nobody.
3. **The zero-row short circuit.** The production body returns `0` and `CONTINUE`s without issuing
   a statement when nothing matches. The replay body issues the `DELETE` regardless. Same returned
   value, but a write attempt on every table every night.
4. **The `COMMENT ON FUNCTION`**, which reverts to text that does not mention the audit log or the
   archive — so `\df+` stops describing the behaviour the function is supposed to have.

**Which of those bite today.** All seven enabled policies currently have `archive_table_name IS
NULL`, so loss 2 is **latent** — real, but not yet reached. Loss 1 is **active on all seven**: in
a replayed environment every nightly deletion is unaudited from the first run.

### The consequence

Cron job `run-data-retention` (`0 3 * * *`, active) calls this function nightly. In an environment
built from migrations rather than from a production baseline, it silently deletes from **seven**
tables with no audit row:

| Table | Date column | Retention |
|---|---|---:|
| `safety_incidents` | `incident_date` | 1825 days (OSHA 1904.33, 5 years) |
| `daily_jsa` | `job_date` | 365 |
| `daily_equipment_inspections` | `inspection_date` | 365 |
| `dvir_reports` | `report_date` | 90 |
| `telemetry_events` | `created_at` | 90 |
| `user_activity_sessions` | `last_seen_at` | 30 |
| `notification_outbox` | `created_at` | 30 |

(The eighth row, `sms_opt_out_events`, is `enabled = false` and is now additionally protected by
`20260909230000_retention_protected_tables_guard.sql`.)

**The retention audit trail was built as a compliance control** — that is the entire content of
`20260216100003`, whose sibling migrations in the same batch are `cert_records_audit_triggers` and
`protect_equipment_user_id`. A replayed environment loses that control without any signal, and
because production is fine, nobody looking at production would find it.

### Why the project's own gate cannot catch this

`supabase/.localgate/run.sh` baselines from `prod_schema.sql` — which contains the **correct**
body — and then applies only migrations with a version above `baseline_anchor.txt`
(`20260608230400`). Neither of these two files is above that anchor, so neither is ever replayed.
The gate is green and will stay green. This is a second, independent reason the divergence has
survived: the one tool that replays migrations here starts downstream of it.

It also compounds with the entry above — full replay from zero already fails on
`20241205_job_tracker` — so "replay from zero" is not a path anyone currently walks, which is
exactly why a defect on that path went unnoticed.

### Fix direction — recommended, not applied

**Do not repair this by editing either existing file.** Editing an applied migration changes
history that production has already recorded and does nothing to a database that has already run
it.

The right shape is a **forward migration that installs the production body authoritatively**:

1. Dump the live definition: `SELECT pg_get_functiondef('public.run_data_retention'::regproc);`
2. Commit it verbatim as a new `CREATE OR REPLACE FUNCTION` in a migration that sorts after
   everything, with a comment naming this entry and both superseded files.
3. Confirm a clean forward replay now lands on that body — and note that confirming it requires
   the `20241205_job_tracker` ordering bug above to be fixed first, or a replay harness that
   starts below the anchor. **That prerequisite is the real cost of this fix**, and it should be
   priced in before anyone starts.
4. Only then consider whether the two originals deserve a comment pointing forward.

Applying it is a deliberate, separately reviewed change to a nightly job that deletes OSHA records.
It should not ride along with anything.

### It also means the repo is not the source of truth for this function

Stated plainly because it changes how the function should be read: **for `run_data_retention()`,
the migration files are not authoritative.** Anyone who opens
`20260229150000_data_retention_policies.sql` — the file named after the feature, and the natural
place to look — reads a body that is not what runs. Anyone who writes a `CREATE OR REPLACE` based
on it silently regresses production. This is precisely why
`16-RETENTION-GUARD-ASSESSMENT.md` recommended against putting the opt-out guard inside this
function and used a trigger on `data_retention_policies` instead.

### Cheap scan for the same pattern elsewhere

Not a full audit of the ~170 migrations. Two mechanical passes over the migration directory:

**Pass 1 — functions defined in more than one migration:** 202 distinct functions, **55** defined
more than once. That count on its own is not a finding. Redefinition is the normal way this repo
evolves a function, and in the normal case the *last* file is the intended one, which is what
replay produces.

**Pass 2 — the actual signature of the defect:** the replay-winning (last-sorting) definition being
materially *smaller* than an earlier one, which is what "a base migration sorting after its own
enhancement" looks like. With a threshold of "last body is under 75% of the largest earlier body
and at least 8 lines shorter", **`run_data_retention` is the only hit in the repo**, and it is not
close:

| Function | Last-sorting body | Largest earlier body | Delta |
|---|---:|---:|---:|
| `run_data_retention` | 33 | 85 | **−52** |
| `safety_audit_log_insert` | 54 | 70 | −16 |
| `award_points` | 98 | 111 | −13 |
| `get_user_lifetime_earned` | 6 | 13 | −7 |

The three near-misses were checked by filename and are deliberate later rewrites, not regressions:
`20260627170000_restore_corrective_actions_audit_branch.sql` is a named consolidation,
`20260608210000_award_points_admin_deductions.sql` is a rewrite of `award_points`, and
`20260608230100_gamification_phase2_gate1_season_framework.sql` re-expresses
`get_user_lifetime_earned` against the season framework. In each of those the later file is
plainly the newer intent; in `run_data_retention` the later file is the older intent.

**What this scan does not cover, stated so it is not over-read.** Line count is a proxy for
"lost a branch", so it finds this shape and would miss a semantic regression of similar length —
a changed predicate, a dropped `SECURITY DEFINER`, a different `search_path`. Establishing that
the repo reproduces production for *any* given function requires diffing `pg_get_functiondef`
against the last-sorting definition, function by function. That is the real audit, it is 202
functions wide, and it is not this.

---

## Edge Functions have no typecheck gate — `deno check` cannot resolve `npm:openai@^4.52.5`

**Status:** Recorded 2026-09-09. **Pre-dates the SMS work; not caused by it.** **Partially narrowed the same day and still open** — see "What has since been gated" below. Do not attempt the rest inside an SMS chunk.

**What has since been gated (2026-09-09).** `npm run typecheck` now also runs
`tsc -p supabase/functions/tsconfig.shared.json`, covering `_shared/smsOptOutFilter.ts`,
`_shared/smsMessageLog.ts` and `_shared/phoneE164.ts` — **293 lines of 17,246**, chosen because
they gate safety-critical sends and feed the compliance export. That is a gate, not coverage. The
38 `@ts-nocheck` files, including all four send paths and every function entrypoint, are still
unchecked, `deno check` still cannot resolve `npm:openai@^4.52.5`, and everything below this
paragraph is still true of them. Scope and reasoning:
`15-TYPECHECK-REMEDIATION-PLAN.md`.

**Symptom:** `deno check` over `supabase/functions/` fails to resolve `npm:openai@^4.52.5` and aborts. Because it aborts on module resolution rather than on a type error, it type-checks nothing — including files that have no relationship to OpenAI.

**Where it comes from:** five functions import the OpenAI client from a CDN specifier rather than the pinned import map:

`generate-safety-announcement`, `generate-attendance-summary`, `generate-fixes-summary`, `generate-maintenance-summary`, `get-smart-defaults` — each `import OpenAI from 'https://esm.sh/openai@4'`.

`supabase/functions/deno.json` maps only `@supabase/supabase-js`, so `openai@4` is resolved by esm.sh at check time and the resolution fails. The exact link between the CDN specifier and the `npm:` form in the error text was **not** traced — the failure was observed, the mechanism inferred. Worth ten minutes of confirmation before anyone attempts a fix.

**What this means in practice — the gap, stated plainly:**

| Path | Lint | Typecheck |
|---|---|---|
| `src/**` (app) | `npm run lint` (ESLint) | `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) |
| `supabase/functions/**` (Deno) | `deno lint` only | **none** |

`tsc --noEmit -p tsconfig.app.json` has `include: ["src"]`, and root `tsconfig.json` excludes `supabase/**` six different ways. So nothing in `supabase/functions/` was reachable by the TypeScript gate regardless of the Deno problem, and most function `index.ts` files also carry `// @ts-nocheck` for Deno compatibility, which would suppress checking even if they were in scope. As of 2026-09-09 the three files named above are reachable via the second `tsc` project; **everything else in `supabase/functions/` still has zero type coverage from lint, typecheck and build combined.**

Everything shipped in Chunks 1–4 rests on `deno lint`, unit tests, and local dry-runs. Worth noting which side of the line each piece falls on:

- The `_shared/` SMS helpers (`phoneE164.ts`, `smsOptOut.ts`, `smsOptOutFilter.ts`, `smsMessageLog.ts`, `smsDeliveryReceipts.ts`) do **not** carry `@ts-nocheck` and are the parts covered by Vitest. But Vitest transpiles via esbuild without type-checking, and `tests/**` is outside `tsconfig.app.json` too — so even these are tested for behaviour, not for types.
- The function entrypoints (`clicksend-inbound-webhook`, `clicksend-optout-reconcile`, `clicksend-delivery-receipts`, the four send paths) carry `@ts-nocheck` and have no unit coverage of their own.

A type error in an Edge Function therefore reaches production and surfaces as a runtime failure, and the cron paths fail asynchronously (see the `cron_http_failures` work in Session 7). Behavioural unit tests over `_shared/**` are the substitute gate, which is part of why logic belongs in `_shared/**` rather than in `index.ts`.

**What a fix would need (not attempted):**

1. Pin `openai` in `supabase/functions/deno.json` `imports` (e.g. `"openai": "npm:openai@4"`) and change the five CDN imports to the bare specifier — the same shape `@supabase/supabase-js` already uses. Confirm the pinned version's types actually resolve under `deno check` before committing.
2. Confirm `deno check supabase/functions/**/*.ts` then completes, and triage what it reports. Expect a first run to surface real errors that have accumulated unchecked — this is the part that makes it a task rather than a one-liner.
3. Remove `// @ts-nocheck` file by file as each is made to pass, not in bulk.
4. Add `deno check` to the gate set only once it is green, so it does not land as a permanently-red step.

Steps 2 and 3 are the cost. Step 1 alone may make `deno check` run without making it pass, which is a worse state than today if it is wired into CI at that point.

**Related:** GitHub issue #5 covers the migration-replay gap; this is the equivalent gap for Edge Function types. No issue filed yet.

---

## The two SMS export Playwright specs had never executed — now partly verified, and one assertion was wrong

**Status:** Recorded 2026-09-09. **Partly resolved the same day.** Read the "still unverified"
section before treating either spec as coverage.

### What was true until now

`tests/e2e/sms-communications-export.spec.ts` (Session 11A) and
`tests/e2e/sms-opt-out-events-export.spec.ts` (Session 12) were both **written and committed
without ever having run**. Every attempt failed in `loginAs()` with `Invalid login credentials`,
because the `@atts.test` users the helper signs in as do not exist in the production project the
default `.env` points at. Both sessions disclosed this. It is recorded here separately because a
committed spec file is read as coverage by default, and these were not.

### The reason given at the time was partly wrong, and the correction matters

Sessions 11A and 12 recorded that `npm run test:setup` was not run because it *"would create real
accounts in production"*. **It would not have.** `tests/setup/e2eEnv.ts` already exports
`assertSafeE2ETarget()`, which both `seedTestUsers.ts` and `playwright.config.ts` call, and which
**refuses** to run when the resolved Supabase URL is project ref `emqqxfzahmwnehxcpxzp` unless the
operator sets `E2E_ALLOW_PROD=I_UNDERSTAND_THIS_WRITES_TEST_DATA_TO_PROD`. `.env.test` is
committed-adjacent (gitignored, with a `.env.test.example` template) and already points at
`http://127.0.0.1:54321`.

So the "safe fix" this entry would have asked someone to build — a non-production target and
seeded test users — **already existed and was already wired**. What was missing was only that
nobody had started the local stack and pointed the specs at it. That is worth stating plainly,
because "we need to build a safe path first" is a much larger-sounding blocker than "run
`supabase start`", and it kept two specs unrun for two sessions.

### What has now been verified

Against a local Supabase stack (`http://127.0.0.1:54321`, 113 public tables including
`sms_message_log`, `sms_message_log_compat`, `sms_opt_out_events`):

1. `npm run test:setup` — seeded 6/6 `@atts.test` users into the **local** project. The guard
   allowed it because the target is not production.
2. `20260909210000_sms_optout_6644_historical_record.sql` applied to the **local** database only,
   so the opt-out section has a row and the provenance assertions are actually reached rather than
   short-circuiting on an empty range.
3. `npx playwright test tests/e2e/sms-communications-export.spec.ts tests/e2e/sms-opt-out-events-export.spec.ts --project=chromium`
   → **3 passed, 2 skipped, 0 failed.**

### Running them found a bug — in the spec, not the app

`sms-opt-out-events-export.spec.ts` asserted
`await expect(section).not.toContainText(/SMS Communications/i)` as its "the two sections are not
merged" check. That assertion **cannot pass and never could**: the opt-out section's own
description says *"Separate from SMS Communications: this is what was said to us, not what we
sent"* — it names the other section deliberately, to explain the separation it is being tested
for. A plain-text search was the wrong instrument.

Replaced with two assertions that mean what the test says: the opt-out section contains **no
heading** matching `/SMS Communications/`, and **no `th`** matching the send log's distinctive
`Provider Status` / `Delivery Status` columns.

This is the whole argument for running a spec before trusting it. The assertion had been reviewed,
committed, and cited as covering the separation, and it was never capable of passing.

### Still unverified — do not read the pass as full coverage

- **The two `unavailable` branches have still never executed.** Both specs' first test asserts
  that a *missing table* renders an "unavailable" warning rather than a count of zero — the
  never-conflate-these-two contract that is the reason both specs exist. Both `test.skip()`
  themselves when the table is present, which it is everywhere the specs can currently run. That
  branch needs an environment where `sms_message_log` / `sms_opt_out_events` are absent, and it
  has no such environment today. **The most load-bearing assertion in each file is the one still
  unrun.**
- **Verified against local, not production.** The local stack's data is seeded, so the specs
  confirm the UI contract, not the production content.
- **Never run in CI on this branch.** `.github/workflows/e2e.yml` triggers on
  `push`/`pull_request` to `main`/`master` only, and seeds from repository secrets whose target is
  not visible from the repo. If that secret resolves to the production ref, `assertSafeE2ETarget()`
  will refuse and the seed step (`continue-on-error: true`) will pass silently while `loginAs`
  fails downstream — the same failure this entry is about, one layer further away from anyone
  reading it.
- **Chromium only.** The mobile and tablet projects were not run.

### What a fuller fix would need — not built

A disposable environment where the SMS tables can be **absent**, so the `unavailable` branches
execute. Either a second local database provisioned below the SMS migrations, or a spec-level
mechanism to force the unavailable state. Both are real work and neither is SMS-chunk work.
Separately, `e2e.yml`'s seed step should not be `continue-on-error: true` — a seed that fails
turns every downstream auth failure into noise.

---

## Corrected belief: "ClickSend enforces STOP at the carrier"

**Status:** Belief withdrawn 2026-09-09. Correction shipped the same day.

**What was believed.** From the earliest planning docs through Chunk 3, every layer of this
project assumed a carrier backstop: `docs/SMS_ESCALATION.md` stated *"ClickSend handles STOP at
the carrier level automatically — no application-side webhook needed"*; `11-COMPLIANCE-SOP.md`
§5.3 stated ClickSend *"enforces this at the carrier level immediately regardless of app state"*;
`PAYROLL_SMS_REMINDER.md` asserted *"no SMS is delivered to STOP-blocked numbers."*

**What it was load-bearing for.** Chunk 3 deliberately deferred adding an
`sms_operational_opt_out` filter to the safety-briefing reminder and escalation send paths. The
stated reasoning was that a premature filter could silently suppress a safety briefing to
reachable crew, and that this risk outweighed the gap because *the carrier was blocking
opted-out numbers anyway*. Remove the backstop and the trade collapses: there was no enforcement
anywhere in the chain, in the app or at the carrier.

**What the receipt evidence proved.** Session 8 ingested ClickSend delivery receipts as a fact
distinct from submission status. Last4 `6644` has been on ClickSend's opt-out list
(list `3406168`) since **2026-03-04T22:51:37Z**. Since then that number recorded **530 delivered
vs 2 failed**, 36 of them in September alone. A blocking carrier cannot deliver 530 messages.
The mechanism: ClickSend's opt-out list is consulted for sends addressed *to that list*; the
portal posts ad-hoc to a raw `to` number, so the list is never consulted.

**Dates.**

| When | What |
|---|---|
| 2026-03-04 | `6644` texted STOP; ClickSend records the opt-out |
| 2026-03-04 → 2026-09-09 | 530 further messages delivered to that number |
| 2026-09-09 (Session 8) | Delivery receipts ingested; the 530/2 split observed; carrier-block inference withdrawn in `13-UNREACHABLE-CREW.md` |
| 2026-09-09 (Session 9) | Deferral lifted; send-path filter added to both briefing paths; false claims corrected across the repo |

**Why an auditor should care.** The false claim was not incidental — it was cited as the
justification for *not* building the control. A belief that excuses the absence of a control
deserves direct verification, not inference. It went unverified for six months.

**Corrected in:** `docs/SMS_ESCALATION.md`, `docs/PAYROLL_SMS_REMINDER.md`,
`docs/sms-upgrade/11-COMPLIANCE-SOP.md`, `docs/sms-upgrade/05-CHUNK3-RUNBOOK.md`,
`docs/sms-upgrade/00-BUILD-BRIEF.md`, `docs/sms-upgrade/08-BLOCKED-HISTORY-PROPOSAL.md`,
`docs/sms-upgrade/12-PROJECT-SCOPE.md`.

---

## A vendor list is not a system of record: the PO app can write to the ClickSend Opt-Out List

**Status:** Recorded 2026-09-09. **Not a bug to fix — a standing constraint on how evidence is
stored.** Read it before anyone proposes relying on ClickSend for a compliance fact again.

**The fact.** The ClickSend Opt-Out List (list `3406168`) held, until 2026-09-09, the *only*
surviving copy of the 2026-03-04 STOP from last-4 `6644` — the original inbound message aged out
of ClickSend's ~4-month history retention and `/v3/sms/inbound` returns zero rows. That list is
account-level, and the ATTS portal is **not the only application on the account**. The
purchase-order approval app (`webhook-approval-for-6061.bolt.host`, sending from PO#
`+18338612650`, owner unidentified — see `12-BRADEN-TODO.md` §4) shares the same ClickSend
account and therefore has the same **write** access to that list: its own inbound STOP handling,
its own dashboard sessions, its own API credentials can add to it, and can remove from it.

**Why that matters more than it first sounds.** The record was not merely fragile in the ordinary
"a vendor could have an outage" sense. It was mutable by a system this repo does not own, cannot
read the source of, and has no change log for. Had the PO app cleared or rewritten that entry —
deliberately, or as cleanup, or by a shared-account admin tidying a list they assumed was theirs —
there would have been no deletion event to find, no before-state to diff against, and nothing
anywhere else to notice the loss. A TCPA-relevant fact would have ceased to exist and no alarm
would have sounded. The evidence's survival to 2026-09-09 was luck, not design.

**The general rule this is an argument for.** A vendor list can be a *source* — something you
reconcile against and copy from — but it cannot be the system of record for a compliance fact.
Systems of record need three properties a shared vendor list structurally cannot offer: a single
identified owner, an audit trail of changes, and backups you control. Screenshots do not
substitute; a dashboard screenshot pasted into Slack is a picture of a claim, not a record of one.

**What was done about it.** Migration `20260909210000_sms_optout_6644_historical_record.sql`
copied the STOP into `sms_opt_out_events`, a table in a database ATTS owns and backs up nightly,
with `received_at` set to the real provider timestamp rather than the write time.
`20260909220000_sms_retention_protection.sql` then protected that table from `run_data_retention()`
(comments, a policy `notes` column, an explicit `enabled = false` policy row). The remaining
un-guarded path is assessed in `16-RETENTION-GUARD-ASSESSMENT.md`.

**What is still true and unaddressed.** Every *other* entry on that opt-out list is still held
only by ClickSend, still writable by the PO app, and still un-mirrored into Postgres. Nightly
reconciliation (`clicksend-optout-reconcile`) reads the list and would surface an entry that
appears; it does **not** notice an entry that silently *disappears*, because a removal looks
identical to an entry that was never there. That is the residual exposure, and it is the reason
`12-BRADEN-TODO.md` §4c requires the STOP to be copied into Postgres *before* any list entry is
cleared, rather than after.

**Do not wire an inbound rule on PO#** (`12-BRADEN-TODO.md` §4). Same root cause, opposite
direction: writing to a shared vendor surface we do not own is as unsafe as reading from it as
though it were authoritative.
