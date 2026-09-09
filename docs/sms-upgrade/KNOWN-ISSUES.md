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

## Edge Functions have no typecheck gate — `deno check` cannot resolve `npm:openai@^4.52.5`

**Status:** Recorded 2026-09-09. **Pre-dates the SMS work; not caused by it and not fixed by it.** Do not fix inside an SMS chunk.

**Symptom:** `deno check` over `supabase/functions/` fails to resolve `npm:openai@^4.52.5` and aborts. Because it aborts on module resolution rather than on a type error, it type-checks nothing — including files that have no relationship to OpenAI.

**Where it comes from:** five functions import the OpenAI client from a CDN specifier rather than the pinned import map:

`generate-safety-announcement`, `generate-attendance-summary`, `generate-fixes-summary`, `generate-maintenance-summary`, `get-smart-defaults` — each `import OpenAI from 'https://esm.sh/openai@4'`.

`supabase/functions/deno.json` maps only `@supabase/supabase-js`, so `openai@4` is resolved by esm.sh at check time and the resolution fails. The exact link between the CDN specifier and the `npm:` form in the error text was **not** traced — the failure was observed, the mechanism inferred. Worth ten minutes of confirmation before anyone attempts a fix.

**What this means in practice — the gap, stated plainly:**

| Path | Lint | Typecheck |
|---|---|---|
| `src/**` (app) | `npm run lint` (ESLint) | `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`) |
| `supabase/functions/**` (Deno) | `deno lint` only | **none** |

`npm run typecheck` runs `tsc --noEmit -p tsconfig.app.json`, whose `include` is `["src"]`, and root `tsconfig.json` excludes `supabase/**` six different ways. So nothing in `supabase/functions/` is reachable by the TypeScript gate regardless of the Deno problem. Most function `index.ts` files also carry `// @ts-nocheck` for Deno compatibility, which would suppress checking even if they were in scope. The three gates this project runs after every change — lint, typecheck, build — collectively provide **zero** type coverage of Edge Function code.

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
