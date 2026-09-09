# SMS upgrade session log

Append-only. Newest entry at the bottom.

---

## 2026-09-02 — Session 0–1 (scaffolding + discovery + Chunk 1)

**Phases completed:** Phase 0, Phase 1, Gate, Phase 2.

**Gate result:** PASSED. Zero WRONG findings that break Chunk 1’s unified-log design; Blockers empty; design check agreed with unified log; logging location decided (`sendAndLogSMS` wrapper, not inside `sendSMS()`).

**Branch:** `feat/sms-upgrade` (from `main` at `209fa4f`)

**Commits:**

| Hash | Message |
|---|---|
| `0947d2e860e662b3e0572aa1be79dab44c3ac620` | docs(sms): planning docs for SMS pipeline upgrade |
| `f3c70344a5d618f726e2cde93402fb7033033029` | chore(cursor): sms-upgrade skill, scoped rule, clicksend audit script |
| `2b17cc400b782c8af3fb4c7c70159566a78fee93` | docs(sms): discovery report |
| `cc9df5a28db4b75a1f6ad7b6b34d3680f9c79406` | checkpoint: before chunk 1 |
| `f8a6c570359c2ee0ccd40245b17377bec105ba7e` | feat(sms): unified sms_message_log + per-recipient logging (chunk 1, dry-run safe) |

**PR:** https://github.com/BradenTabor/ATTSemployeePortal-main-2/pull/3 (draft)

**Gates status:** `npm run lint`, `npm run typecheck`, `npm run build` passed after Phase 0 and after Phase 2. `npx vitest run --config tests/vitest.config.ts tests/unit/sms-message-log.test.ts` passed (4 tests). Production dry-run of the four SMS functions was **not** run (migration not applied remotely; session forbids deploy/`db push`).

**Uncertainties / incomplete:**

- ClickSend read access unavailable: no `CLICKSEND_*` in `.env`, no `clicksend` block in `~/.cursor/mcp.json`. Audit script exited 2. Two-number HYPOTHESIS unresolved.
- Supabase MCP was authenticated to other projects, not ATTS prod `emqqxfzahmwnehxcpxzp`, so live SMS log queries were not possible.
- Reminder dry-run is new; cron empty-body still sends live. Mass SMS still includes `@atts.test` and still uses unset `from`.
- `sms_operational_opt_out` is still not checked by reminder or escalation (intentional — no behavior change).

---

## 2026-09-09 — Migration fix, PWA split, Braden decisions, Chunk 2 prep

**Part A — Postgres 16 migration bug**

- `sms_compat_uuid` used `CAST(... AS bit(128)) AS uuid`, which fails on PG16 (`cannot cast type bit to uuid`). Fixed to `md5(p_seed)::uuid`.
- Added `scripts/test-sms-migration-local.sh` (throwaway `postgres:16`, stubs, seed, assert compat count=3). Replay PASS: `compat_row_count=3`, `source_tables=mass_sms_log,payroll_reminder_sms_log,sms_escalation_send_log`.
- Corrected `02-CHUNK1-VERIFICATION.md`: prior “verified” claim was text-only; original SQL was broken.

**Part B — Split unrelated PWA work**

- Created `feat/pwa-app-update` at `694be04` (commits `ec1327c`, `694be04`).
- Removed those two commits from `feat/sms-upgrade` via `git reset --hard 9b144ca` (suggested `rebase --onto 9b144ca ec1327c~1` was a no-op because `ec1327c~1 == 9b144ca`).
- Session log was never modified by the PWA commits (only created in `9b144ca`); kept on SMS branch.
- Force-pushed `feat/sms-upgrade` with `--force-with-lease` (draft PR #3; agent-only pushes). Separate draft PR for PWA.

**Part C — Braden decisions (do not re-ask)**

1. **STOP → both opt-out flags** (`sms_operational_opt_out` + `sms_marketing_opt_out`). Safety contact after STOP is out-of-band (call/supervisor). Recorded in `01-DISCOVERY-REPORT.md` Q6; act in Chunk 3.
2. **Mass SMS `@atts.test` + unset `from`:** leave alone until Chunk 4. Recorded in Q7; Chunk 2 must not drive-by.
3. **ClickSend account facts:** still unavailable; re-run audit script each session; fill discovery section on first success. Two-number HYPOTHESIS stays open.
4. **Supabase MCP** is authenticated to other projects, not ATTS prod `emqqxfzahmwnehxcpxzp` — config item for Braden; agent must not switch it.
5. Retention, consent language, DOT/CDL scope: still with Braden; affect Chunks 5–6 only.

**Gates:** lint / typecheck / build after Part A+D commits.

**Part D — Chunk 2 (SMS export section)**

- Added `SMS Communications` `SectionConfig` to `ComplianceDataExportPanel.tsx`: reads `sms_message_log_compat`, `is_dry_run=false`, date on `sent_at`, join `app_users` for name/role, exclude `%@atts.test%`, preview last-4 / CSV full E.164 / PDF no phone, `logReportExported`.
- Soft-empty when relation missing (pre-`db push`) so Load empty-state does not hard-fail.
- Fixed stale `accessor:` docs in `.cursor/skills/scaffold-admin-page/references/export-pattern.md` → `key` + `format`.
- E2E: `tests/e2e/sms-communications-export.spec.ts`. Not executed here: Playwright prod guard (no `.env.test` / local Supabase). Spec is ready once a test project is configured.
- Docs: `04-CHUNK2-VERIFICATION.md`.
- Gates: lint ✅ typecheck ✅ build ✅.


---

## 2026-09-09 — Session 2 (soft-empty fix + Chunk 1–2 local verification)

**Part A — Soft-empty export bug**

- Replaced `isMissingRelationError` free-text regex soft-`[]` with `classifySmsExportQueryResult` (`PGRST205`/`42P01` → unavailable only).
- Three UI states: unavailable (amber, no count, no export), error (red alert), empty (`0 records in range…`).
- Unit tests `tests/unit/sms-export-load-state.test.ts` — 6/6 pass.
- E2E split into pre-migration unavailable vs post-migration count.
- `scripts/test-sms-migration-local.sh` skips exit 0 when Docker absent.
- Commit: `cd3822e` fix(sms): distinguish unavailable SMS export from empty range.

**Part B — Verify Chunks 1–2 on local Supabase**

- Docker/Colima running; `open -a Docker` N/A (Desktop not installed).
- Full `supabase db reset` / migration replay from zero: **FAILED** on known `20241205_job_tracker` → `app_users` ordering (per CONVENTIONS).
- `bash supabase/.localgate/run.sh`: **GATE PASSED**, +11 forward migrations; Sept 2 field-audit then SMS applied in order with no conflict.
- Bootstrapped local `supabase start` (exclude vector/logflare/mailpit) + loaded `atts_gate` public schema.
- Compat seed verified (5 rows; name join + last-4 fallback).
- Dry-ran all four SMS Edge Functions locally: reminder sent=2, escalation dryRunWouldSend t1+t2, payroll eligible_count=3, mass countWithPhone=3; unified DRY_RUN rows written; legacy counts unchanged. Fixed escalation zero-overdue legacy insert missing `!dryRun`.
- E2E against local: post-migration **PASS**, pre-migration **SKIP** (view present).
- Docs: `02-CHUNK1-VERIFICATION.md`, `04-CHUNK2-VERIFICATION.md` updated with actual output.

**Gates:** lint ✅ typecheck ✅ build ✅

**Do not start Chunk 3** (per session brief).

---

## 2026-09-09 — Session 3 (Chunk 3: inbound opt-out sync + legacy attribution)

**Part A — Legacy phone attribution**

- New migration `20260909100000_sms_compat_legacy_phone_user_attribution.sql`: `normalize_phone_to_e164()` + `CREATE OR REPLACE VIEW sms_message_log_compat` with `LEFT JOIN app_users` on escalation/payroll legacy branches only.
- Extended `scripts/test-sms-migration-local.sh`: Casey seed `+15551234001` → `user_id` resolved; payroll `+15551230002` unmatched → `NULL` row preserved.

**Part B — Chunk 3 inbound opt-out sync**

- `20260909110000_sms_opt_out_events.sql`: `sms_opt_out_events` table, RLS (admin SELECT, service insert), unique `provider_message_id`, kill-switch seeds, disabled `clicksend-optout-reconcile` pg_cron.
- Edge Functions: `clicksend-inbound-webhook`, `clicksend-optout-reconcile` (auth mirrors `notify-admins-new-signup`; deploy `--no-verify-jwt`).
- Shared: `_shared/phoneE164.ts`, `_shared/smsOptOut.ts` (keyword parse, reconcile diff).
- Unit tests: `tests/unit/sms-opt-out-inbound.test.ts` (18 tests). Local e2e: `scripts/test-sms-inbound-webhook-local.sh` — STOP flips both flags; duplicate POST no-op.
- Runbook: `docs/sms-upgrade/05-CHUNK3-RUNBOOK.md`.
- Send-path filters on reminder/escalation **unchanged** (deferred until reconciliation trusted).

**Part C — Housekeeping**

- GitHub issue #5: `20241205_job_tracker` replay failure (also `docs/sms-upgrade/KNOWN-ISSUES.md`).

**Gates:** lint ✅ typecheck ✅ build ✅ vitest SMS suite 29/29 ✅


---

## 2026-09-09 — Session 4 (production deploy Chunks 1–3)

**Pre-flight:** Wrong Supabase account (ATS drone Org) blocked first attempt; logged out; correct login linked `emqqxfzahmwnehxcpxzp`. Cron window safe after 16:00 escalation.

**Migrations (first):** Applied `20260902200000`, `20260909100000`, `20260909110000` via `db query --linked` + `migration repair --status applied` (db push blocked by remote history mismatch). Compat view: **4050** rows (esc 3006 / pay 1035 / mass 9).

**Secrets:** `INTERNAL_SECRET`, `CLICKSEND_USERNAME`, `CLICKSEND_PASSWORD` present; **`CLICKSEND_FROM_NUMBER` unset** (finding).

**Functions:** Deployed four modified SMS functions + `clicksend-inbound-webhook` / `clicksend-optout-reconcile` (`--no-verify-jwt`). Cron auth: script DNS-failed on direct DB host; SQL applied via Management API path; reconcile cron **active=false**.

**Dry-runs only:** Payroll `force_day=1` → eligible 19, 19× `sms_message_log` DRY_RUN rows; legacy tables unchanged 411/48/9. Reminder/escalation skipped “Already sent today”; escalation overdue **11** matches live tier log. Mass dry-run: `countWithPhone=19`, `fromNumber=null`. Webhook GET ok. Reconcile diff-only: 1 clicksend-only contact; apply_enabled false.

**ClickSend audit:** Two REGISTERED numbers in outbound history (`+18338612650`, `+18443781444`); Safety# pending; opt-out list size 1. Discovery section filled.

**Docs:** `06-DEPLOY-LOG.md`; runbook webhook URL + Braden steps; session log; PR #3 undrafted for review.

**Not done (intentional):** no live SMS; no apply mode; no operational opt-out filter on reminder/escalation; reconcile cron disabled.

---

## 2026-09-09 — Session 5 (cron monitoring blind spot + Chunk 4 prep)

**A — Monitoring**

- Root cause: `get_recent_cron_failures` only filtered `cron.job_run_details.status = 'failed'`. Jobs use async `net.http_post`, so queue success → cron `succeeded` / `1 row` even when the Edge Function returns 401. Failures lived only in `net._http_response`.
- Fix applied (prod + migration file): `20260909173000_cron_failures_detect_http_non_2xx.sql` — extends `cron_job_runs` (`effective_status`, `http_status_code`) and `get_recent_cron_failures` to UNION non-2xx / timed_out / error_msg from `net._http_response` (time-correlated to HTTP cron runs).
- History window: `pg_net.ttl = 6 hours`. Oldest retained row today was 10:20 UTC; **18× 401** all in the safety-briefing-reminder-push slot; later jobs today (10:40 SMS, 12:30 forecast, 15:00 compliance, 16:00 escalation) were 200. Pre-today duration **unknowable** from pg_net. No other job showed 401s in the retained window.
- Alert proposal (not built): add a single “Cron health” row to the existing admin compliance / safety settings surface (or a line on the monthly compliance email) that calls `get_recent_cron_failures(1)` and flags any `http_failed` / SQL failed jobname + timestamp — no new pager stack.

**B — Blocked history**

- Proposal only: `docs/sms-upgrade/08-BLOCKED-HISTORY-PROPOSAL.md` (derived view flag + optional `sms_provider_opt_out_snapshot`; no row rewrites).
- Distinct numbers affected: **1** (last4 `6644`, 726 post-opt-out compat rows). No opt-out flags changed.

**C — Chunk 4**

- Plan: `docs/sms-upgrade/09-CHUNK4-PLAN.md`. Not implemented.
- From-distribution: PO# majority is **purchase-order approval SMS** outside this portal (bodies + API user), not mis-routed briefing SMS. Portal scheduled paths correctly use RTO#.
- Audit’s 3 RTO Failed (last-~1000 page): 2026-09-09 10:40 UTC → last4 `6286`, `4421`, `1454`; ClickSend `status_code` 301 / Absent Subscriber (phone off / out of range ≥12h).

**D — Housekeeping**

- `deploy-cron-auth.sh` credential-echo fix is present in working tree (**not committed** this session). No script echoes a live connection string (host-only after redact).
- Cron inventory: noted monthly-safety-drawing `x-drawing-secret` as intentional Bearer exception.

**Not done:** Chunk 4 implementation; blocked-history view; opt-out flag changes; commit of deploy-cron-auth.sh / this session’s files (unless requested).

---

## 2026-09-09 — Session 6 (consolidated follow-up A–G; no Chunk 4 impl)

**A — ClickSend wiring pre-flight**

- Kill-switches present: `sms_inbound_webhook_config={"enabled":true}`; `sms_optout_reconcile_config={"apply_enabled":false}`.
- Missing inbound row would **not** skip (code only skips when `enabled === false`); no seed migration needed.
- Auth shapes: `x-internal-key`, `Authorization: Bearer INTERNAL_SECRET`, `Authorization: Bearer service_role`.
- Contingency (design only): `10-WEBHOOK-AUTH-FALLBACK.md`.
- GET health: `{"ok":true,"name":"clicksend-inbound-webhook"}` HTTP 200.

**B — Runbook**

- Rewrote `05-CHUNK3-RUNBOOK.md`: pre-flight block, both-numbers requirement, ranked §7 STOP tests, first-week queries, real project URL throughout.

**C — 6644 briefing**

- `11-OPTOUT-6644-BRIEFING.md`: opt-out 2026-03-04T22:51:37Z; 726 rows (t2 268 / reminder 266 / payroll 192); 2 active escalation recipient rows; **132/132** t2 days had overdue≥4; roles admin+employee; **no** other escalation last4 on ClickSend opt-out list.

**D — Cron monitoring**

- Root cause unchanged: async `net.http_post` → cron `succeeded` despite Edge 401.
- Fix already in prod (`20260909173000`); `get_recent_cron_failures(1)` returns the 401s.
- pg_net window: oldest retained ~10:20 UTC today; **18×401** only on `safety-briefing-reminder-push` that slot; pre-today duration unknowable (ttl ~6h). Alert proposal noted in cron inventory (not built).

**E / F**

- `08-BLOCKED-HISTORY-PROPOSAL.md` / `09-CHUNK4-PLAN.md` confirmed; distinct blocked numbers = **1** (`6644`). From-distribution = external PO traffic. Audit’s 3 RTO failures = May 11–13 301s last4 `4451`/`4451`/`4421`.

**G**

- `deploy-cron-auth.sh` credential-echo fix confirmed (host-only). `12-BRADEN-TODO.md` written. Commits per section. No opt-out flags / escalation rows / historical SMS rows changed.

**Gates:** lint / typecheck / build (this session).

---

## 2026-09-09 — Session 7 (durable cron failures, RTO#-only wiring, silent unreachability)

**A — Cron failure monitor now outlives pg_net**

- Problem with Session 5/6's fix: detection was correct but `pg_net.ttl` ≈ 6h, so the evidence expired before any report could read it. A monthly compliance line against 6-hour data would almost never observe a failure.
- New migration `20260909180000_cron_http_failures_durable.sql`, applied to prod via `db query --linked` + `migration repair --status applied`:
  - `public.cron_http_failures` — durable row per non-2xx/timed-out cron HTTP response (`jobname`, `function_name`, `cron_runid`, `status_code`, `response_excerpt`, `occurred_at`). RLS admin-SELECT, `GRANT ALL` to service_role, same shape as the other log tables.
  - `public.sweep_cron_http_failures(lookback_hours default 8)` — SECURITY DEFINER, idempotent via unique `(response_id, occurred_at)`. Pair rather than bare `response_id` so a pg_net sequence reset cannot silently suppress inserts. 8h lookback > 6h TTL, so a skipped sweep cannot open a gap.
  - pg_cron job `cron-http-failure-sweep`, `7 */2 * * *`, jobid 114, active. **Pure SQL** — no Edge Function, no service-role Bearer, so it survives the exact auth failure it exists to detect.
  - Attribution: responses carry no URL, so correlate to the nearest preceding `net.http_post` cron run within 2 minutes; when the `cron.job` row is gone (job recreated), fall back to the fixed UTC slot rather than storing `orphaned-job-N`.
  - `get_recent_cron_failures(days)` reads the durable table first, unions the not-yet-swept tail from `net._http_response`, dedupes on response id. `cron-http-failure-sweep` added to the monitored list in both the function and `cron_job_runs`.
- Verified in prod: first sweep inserted **19** rows (18× HTTP 401 + 1 timeout, all `safety-briefing-reminder-push`, 2026-09-09 10:20 UTC). Second sweep inserted **0** (idempotent). `get_recent_cron_failures(7)` returns 19, not 38 (dedupe correct).
- **A.5 — no backfill, none possible.** Stated in `docs/cron-jobs-inventory.md`: pre-2026-09-09 cron failure history is unrecoverable. `net._http_response` had already discarded it and `cron.job_run_details` recorded those runs as `succeeded`.
- **A.4 alert proposal (not built):** “Cron health (last 7 days)” section on `weekly-safety-audit-report` (Fri 5 PM CST, existing recipients via `email_recipient_lists`, already section-composed). Must print an explicit “0 cron failures this week” when clean so a missing report is distinguishable from a healthy one — the report is itself an HTTP cron and can fail the same way. Escalation if Friday is too slow: have the 2-hour SQL sweep insert a `notification_events` row (`admin_notice` / `high` / role `admin`), the only path whose detection does not depend on Edge Function auth.

**B — Shared ClickSend account changes the wiring plan**

- Runbook + TODO now wire **`+18443781444` (RTO#) only**. PO# gated on two written pre-conditions: who owns `webhook-approval-for-6061.bolt.host`, and whether PO# already has an inbound rule that ours would replace.
- Discovery report gained a “Shared ClickSend account” section. **Reconcile handles non-employee opt-outs cleanly**: `computeOptOutReconcileDiff` emits `clicksend_only` with `user_id: null` (`_shared/smsOptOut.ts:70–79`), apply loop skips them (`clicksend-optout-reconcile/index.ts:213–214`). No error path. The gap is reporting — they are unlabelled and recur every run, and runbook §6 gates apply-mode on `clicksend_only` being “explainable”. Not fixed this session.
- **B.3 recommendation (not executed): set `CLICKSEND_FROM_NUMBER = +18443781444` now.** Verified in code that reminder / escalation / payroll already resolve to that value (`?? "+18443781444"`), so it is a no-op for three of four paths; only `send-mass-sms` (`?? ""`) changes. Leaving it unset means a blast can emit from PO#, whose STOP replies land on the number we are deliberately not wiring. External PO app does not read Supabase secrets. Secret was **not** set.

**C — Silent unreachability (read-only ClickSend history)**

- **Headline:** `sms_message_log_compat` holds 3,046 live sends since 2026-05-01 and **zero** failures; ClickSend recorded **319**. `sendSMS()` stores the submission response and nothing ingests the later `301` delivery status. The requested compat-view sweep is therefore structurally unable to find these numbers.
- Earlier “3 failures on 2026-05-11/12/13” was a sampling artifact of one unfiltered history page.
- `4451` is **not** a case: 97 of 104 delivered, no `app_users` row, number retired 2026-08-12 (same person now at `0665`).
- `4421`: active `employee`, **133 of 136 failed** since 2026-05-01, continuous, ongoing. Three deliveries total.
- `6286`: active `employee` hired 2026-08-31, **6 of 6 failed** — has never received an SMS.
- `1779`: 60 of 104 failed, no `app_users` row, sends stopped 2026-08-12.
- `1454` / `0665` / `9829`: low intermittent failure, normal.
- PO#-sourced failures (`0398`, `6644`, `9951`, `3619`, `2876`, `5979`, `9971`) out of scope; `9971` has no `app_users` row, corroborating the shared-account finding.
- Recorded as a separate section in `11-OPTOUT-6644-BRIEFING.md`, deliberately not merged into the opt-out narrative.

**D — Housekeeping**

- `12-BRADEN-TODO.md` reprioritised: `6644` conversation to #1 (132/132 escalation days had real overdue crew, avg ~12.9, min 4); new #2 is verifying the `4421` / `6286` phone numbers; DB password rotation held at #3.
- Commits: one per section (A, B, C, D).

**Gates:** lint ✅ typecheck ✅ build ✅

**Production changes:** the `cron_http_failures` table, `sweep_cron_http_failures()`, the `cron-http-failure-sweep` job, and the `cron_job_runs` / `get_recent_cron_failures` replacements. Nothing else. No SMS sent (not even dry-run), no opt-out flags touched, no `CLICKSEND_FROM_NUMBER`, no ClickSend writes, no Edge Function deploys, no changes to any legacy SMS log table or `app_users`.
