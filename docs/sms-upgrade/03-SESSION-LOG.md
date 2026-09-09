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

---

## 2026-09-09 — Session 8 (delivery receipts: the export stops over-claiming)

**The problem this session closes.** `sms_message_log` recorded ClickSend's response at
*submission* time, which is almost always `SUCCESS`. Nothing captured what the carrier did
afterwards. So the compliance export asserted delivery it could not substantiate: 3,046 sends
since 2026-05-01 with zero logged failures, while ClickSend held 319.

**A — Told the truth first, before building anything**

- Renamed the SMS export status column to **"Provider Status (submission)"** across CSV, PDF
  and preview. Underlying column name unchanged.
- Added an export footer carried by both CSV and PDF. `ExportMetadata` gained `notes?: string[]`
  so the caveat renders under the table rather than being pasted into a title.
- Same caveat into `11-COMPLIANCE-SOP.md` §5.6 and `12-BRADEN-TODO.md`. Committed on its own
  (`d48a89e`) — the honest position while Part B was still being built.

**B — Pull, not push**

- **B.1.** Checked the actual API rather than assuming. Three options exist, not two:
  | Option | Verdict |
  |---|---|
  | Callback URL (push) | Rejected — one dashboard field on an account shared with the purchase-order app; a wrong value fails silently and forever, and it can be overwritten by whoever owns that app. |
  | `GET /v3/sms/receipts` (pull) | Rejected — **read-once**. Reading a receipt removes it, so a failed run loses data and backfill is impossible. |
  | `GET /v3/sms/history` (pull) | **Chosen.** Read-only, paginated, re-readable, retains ~4 months, carries `status` + `status_code` + `status_text` + `error_code` per message. Reuses the reconcile function's shape and cannot be broken by a misconfigured rule. |
- **B.2.** Migration `20260909190000` adds `delivery_status`, `delivery_status_at`,
  `delivery_error_code`, `delivery_raw` to `sms_message_log`. `provider_status` is never
  rewritten — submission and delivery are different facts and both belong in the audit trail.
- **B.3.** `clicksend-delivery-receipts` Edge Function, deployed `--no-verify-jwt`, diff-only
  by default, kill switch `app_settings.sms_delivery_receipts_config`, cron created **DISABLED**.
- **Idempotency is enforced in the database, not the caller.** A `BEFORE UPDATE` trigger on
  `sms_delivery_receipt` returns `NULL` when nothing about a receipt changed, cancelling the
  write outright. That way a replay is a true no-op regardless of who runs it — cron, manual
  replay, or the backfill script. Proven in prod: two consecutive `apply` runs submitted 117
  receipts each and `max(updated_at)` did not move.
- **Unmatched receipts are kept, not dropped.** 2,772 of 5,404 receipts (51%) match no portal
  send. That is the purchase-order app's traffic, and `is_matched = false` makes it queryable
  evidence instead of an anecdote.
- **B.4 backfill.** Seeded from a full history pull. **2,632** receipts matched portal sends.
  Since 2026-05-01: **2,595 delivered, 229 failed, 80 handed to the network without a final
  receipt, 143 unknown** (pre-2026-05-11, outside ClickSend's retention). The 143 read
  `No receipt` in the export — unknown, deliberately not presented as either outcome.
- **B.5.** Export now carries submission and delivery as two separate columns, plus
  `Delivery Detail` in CSV. Caveat revised to describe what is now actually known.
- **B.6.** Unit tests for mapping, normalisation, matching and idempotency. New localgate
  assertion covers the trigger; it compares `ctid`, not `updated_at`, because the gate runs in
  one transaction where `now()` is frozen and would make the test vacuous.

**C — `CLICKSEND_FROM_NUMBER` set to `+18443781444`**

Verified by `send-mass-sms` dry-run: `fromNumber` reports `+18443781444`, previously `null`.
No send. Recorded in `09-CHUNK4-PLAN.md` as a stopgap that Chunk 4 **deletes** rather than
demotes to an override.

**D — Four unreachable numbers, and a correction**

New `13-UNREACHABLE-CREW.md` (full phone numbers, flagged internal-only).

- **`6644` — the previous briefing's central assumption was wrong.** It reasoned that being on
  ClickSend's opt-out list means the carrier stops delivering, and flagged that as unverified.
  The receipts verify it and it is false: **530 delivered vs 2 failed**, 36 in September. The
  opt-out list only suppresses sends addressed *to that list*; the portal sends ad-hoc to a raw
  number, so it is never consulted. The problem inverts — not "safety alerts went missing", but
  "someone who texted STOP received 500+ messages and the provider holds the dated record".
  Corrected in place with strikethrough so the withdrawn reasoning stays auditable.
- **`4421`** (Tracer, `+14792004421`): 2 delivered / 133 failed. Number is well-formed with a
  valid 479 area code — reads as a disconnected or reassigned mobile, not a typo.
- **`6286`** (James David Mcleod, `8707196286`): 0 delivered / 6 failed, `Absent Subscriber`
  every time. The odd storage format is **ruled out** as the cause — the send path normalises
  it and ClickSend received the correct `+18707196286`.
- **`1779`** (`+14795181779`): no `app_users` row, sends stopped on their own 2026-08-12.
  Confirm the departure, nothing else.

**E — Housekeeping**

`01-DISCOVERY-REPORT.md` records `webhook-approval-for-6061.bolt.host` as the concrete lead for
PO# ownership, and the now-quantified 51% shared-account share.

**Gates:** lint ✅ typecheck ✅ build ✅ unit ✅ localgate ✅ (baseline + 16 forward migrations)

**Production changes:** migration `20260909190000` (four additive columns, `sms_delivery_receipt`,
compat view gaining delivery columns at the end, disabled cron); the
`clicksend-delivery-receipts` function; 5,404 receipt rows; the `CLICKSEND_FROM_NUMBER` secret.

**Not changed:** no `provider_status`, body, recipient, timestamp, opt-out flag or phone number
on any existing row. Verified by an md5 fingerprint over `sms_message_log`,
`sms_escalation_send_log`, `payroll_reminder_sms_log`, `mass_sms_log` and `app_users` taken
before and after the backfill — byte-identical. No SMS sent. No ClickSend writes; the opt-out
list was read, never modified.

**One side effect worth recording:** verifying C required an admin session, so a magic link was
minted for `bradenleetabor@gmail.com` via the admin API (no email sent) and revoked immediately
after. That moved `auth.users.last_sign_in_at` for that account to 2026-09-09 18:27 UTC. No
application data was touched, but the timestamp is not the user's own sign-in.

---

## 2026-09-09 — Session 9, Part B (corrected belief: there is no carrier STOP backstop)

**Believed:** that ClickSend enforced STOP at the carrier, so an opted-out number could not be
reached regardless of app state. Stated as fact in `SMS_ESCALATION.md`, `11-COMPLIANCE-SOP.md`
§5.3, `PAYROLL_SMS_REMINDER.md`, `05-CHUNK3-RUNBOOK.md`, `00-BUILD-BRIEF.md`,
`08-BLOCKED-HISTORY-PROPOSAL.md` and `12-PROJECT-SCOPE.md`.

**Proved false by:** the Session 8 delivery-receipt ingest. Last4 `6644` has been on ClickSend's
opt-out list since 2026-03-04T22:51:37Z and recorded **530 delivered vs 2 failed** afterwards.
A carrier that blocks cannot deliver 530. The list is only consulted for sends addressed to a
contact list; the portal sends ad-hoc to a raw `to` number.

**When:** believed from project inception (docs predate Chunk 1); contradicted by receipts on
2026-09-09 (Session 8); corrected across the repo on 2026-09-09 (Session 9).

**Why it mattered:** the belief was the stated justification for deferring the
`sms_operational_opt_out` send-path filter in Chunk 3. It excused the absence of the only
control that would have stopped the sends. Full record in `KNOWN-ISSUES.md` →
"Corrected belief: ClickSend enforces STOP at the carrier".

---

## 2026-09-09 — Session 9 (the deferral is lifted: opt-out is enforced in the app)

The corrected-belief entry above is the *why*. This is the *what*.

**A — the send-path filter, added to both briefing paths**

Chunk 3 deferred filtering on `sms_operational_opt_out` because a premature filter might suppress
a safety briefing while the carrier blocked opted-out numbers anyway. The second half was never
true, so the trade was never real. The filter is in.

- Shared helper `supabase/functions/_shared/smsOptOutFilter.ts`, so all three operational send
  paths agree on what "opted out" means. `payroll-hours-reminder-sms` already filtered;
  `safety-briefing-reminder-sms` and `safety-briefing-escalation-sms` now do too.
- **Nothing else in recipient selection moved.** Not the overdue definition, not tiering, not
  `company_calendar`, not `user_absences`. The dry-runs below are the proof: `overdue_count`
  stays at 10 in every configuration tested. The filter subtracts from the *recipient* list and
  leaves the *overdue* list alone, which is what makes the audit trail readable — you can see
  both who was overdue and who was not messaged about it.
- **No exclusion is silent.** Each one records `{kind, user_id, phone_last4, reason}` in the run's
  suppression log next to the absence exclusions that were already there, plus a per-run count.
  A person vanishing from the briefing list is explainable from the logs alone.
- **Kill switch** `app_settings.sms_send_optout_filter_config`, migration `20260909200000`,
  default ON. A missing row or an unreadable value also resolves to ON — the failure mode of the
  config is "keep honouring opt-outs", not "start messaging opted-out people".

**A.3 — opted-out Tier 2 static recipients**

`sms_escalation_recipients` has no opt-out column, so state is resolved by matching `phone_e164`
against `normalize_phone_to_e164(app_users.phone_number)`; any one matching row opted out means
the person opted out. Chosen behaviour: **skip the send, and be loud about it.**

- Each skip emits a warning into the response and the logs, naming the last4.
- If the filter empties Tier 2 entirely, that logs at **error** level and still writes an audit
  row with `recipient_count = 0` — a safety escalation that reached nobody must leave a record,
  not a gap.
- A static with **no** `app_users` row is unresolvable, and unresolvable is not consent. Those are
  still sent to, and listed under `tier2_static_optout_unresolved` so the ambiguity is visible.

The alternative — send anyway because it is a safety escalation — was rejected. A person who
texted STOP has withdrawn consent, and "safety" is not a legal exemption from that. But a
silently shortened escalation list is the exact failure this project exists to catch, so the cost
of honouring consent is paid in noise, loudly, rather than in silence.

Tier 1 managers who have opted out are skipped, and their crew is **not** rerouted to Tier 2. That
would be a change to tiering, which was out of scope. The exclusion names the manager so the gap
is visible rather than inferred.

**A.5 — verified against production, dry-run only**

Kill switch OFF reproduces pre-filter behaviour exactly, so it doubles as the before/after control:

| | overdue | eligible | excluded | Tier 2 statics |
|---|---:|---:|---:|---|
| Filter **OFF** (= before) | 10 | 10 | 0 | 3 → 3 |
| Filter **ON**, nobody flagged | 10 | 10 | 0 | 3 → 3 |
| Filter **ON**, one account flagged | **10** | **9** | **1** | **3 → 2** |

Identical with nobody flagged, as required. The single-account test used Braden's `employee` row
(`61d09ffe…`), chosen because that one number is both an overdue recipient *and* a Tier 2 static —
one flag exercises both paths. Exactly one recipient dropped from each, the exclusion appeared in
both suppression logs with `reason: sms_operational_opt_out`, Tier 2 raised
`"Tier2 static recipient ending 6644 excluded"`, and `overdue_count` did not move. Tier 1 showed 0
exclusions, correctly — that user has no supervisor, so he was never in a Tier 1 crew.

The flag was reverted. `app_users` is byte-identical to its pre-test state:
`md5 = b42df8300155d4eb128ea907860be54b`, 21 rows, **0 flagged**, before and after. The test
`UPDATE` ran inside `SET LOCAL session_replication_role = replica` so the `updated_at` trigger did
not fire; that row's `updated_at` still reads `2026-06-28 03:24:54`, untouched.

**B — the false claim, corrected in seven files**

`SMS_ESCALATION.md`, `PAYROLL_SMS_REMINDER.md`, `11-COMPLIANCE-SOP.md` §5.3, `05-CHUNK3-RUNBOOK.md`,
`00-BUILD-BRIEF.md`, `08-BLOCKED-HISTORY-PROPOSAL.md`, `12-PROJECT-SCOPE.md`. Corrected in place
with strikethrough, not deleted, so the withdrawn reasoning stays auditable.

**C — checked against ClickSend's own words, not just our receipts**

New `14-CLICKSEND-OPTOUT-DOCS.md`. Verdict: **ambiguous, resolving against the broad reading.**
ClickSend says "any future messages to that number will be blocked", but every mechanism it
documents is list-scoped — *"you must store your contact lists in ClickSend for the system to
work"*, the STOP keyword is *"available in SMS Campaign only"*, and the opt-out rule is a
`MOVE_CONTACT` list operation. The v3 **Send SMS** reference, the endpoint this portal calls,
never mentions opt-outs at all. No account-level enforcement covering ad-hoc sends is documented.
Asking support whether one exists is recorded as a follow-up; **nothing was enabled or requested.**

**D — the unreachable crew**

`13-UNREACHABLE-CREW.md`: `6644` closed on delivery (530 delivered, false alarm), still open on
consent. `4421` and `6286` remain the live cases, now carrying last-successful-delivery dates
(**2026-05-12** and **never**) and the question to put to each man.

**E — housekeeping**

The sms-upgrade skill now prefers a service-role query over minting an auth session for admin-view
verification, after Session 8's magic link moved `last_sign_in_at` on a real account. It also
requires fingerprinting `app_users` around any verification that touches it.

**Gates:** see below. **Production changes:** migration `20260909200000` (one `app_settings` row);
redeploy of `safety-briefing-reminder-sms` and `safety-briefing-escalation-sms`.
**Not changed:** no opt-out flag, no phone number, no historical row, no ClickSend-side
configuration. **No SMS sent** — every run was `dryRun: true`, and the newest rows in
`sms_escalation_send_log` (16:00 UTC) and `sms_message_log` (16:23 UTC) both predate this session.
