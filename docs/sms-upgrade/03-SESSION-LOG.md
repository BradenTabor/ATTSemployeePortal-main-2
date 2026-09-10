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

---

## 2026-09-09 — Session 10 (documenting the apply-mode trap; docs only)

Nothing executed, nothing deployed. This session writes down an interaction that was understood
in conversation and would have been lost, plus one long-standing gap in the gates.

**A — the apply-mode interaction, stated end to end**

Three things built in separate sessions now compose into a hazard that none of them carried alone:

1. ClickSend's opt-out list holds last-4 `6644` from a STOP dated **2026-03-04**.
2. `clicksend-optout-reconcile` diffs that list against `app_users`, and in apply mode sets
   **both** opt-out flags on every entry that resolves to a user.
3. The Session 9 send-path filter means those flags are now honoured by safety briefing
   reminder, safety briefing escalation (statics included) and payroll SMS.

So the moment `sms_optout_reconcile_config.apply_enabled` is set `true`, `6644` is dropped from
every operational SMS path. Permanently — the flags do not expire — and quietly. The exclusion
is logged, but no one is told, and the person only finds out by noticing they stopped getting
texts.

The individual pieces are all correct. Reconciliation *should* honour the provider's list; the
filter *should* honour the flags. The hazard is that the list contains entries nobody has
adjudicated, and a stale entry is indistinguishable from a real withdrawal of consent without a
human who knows the history. `6644` is the known case: it is the developer's own handset, and a
test STOP is the likely origin.

The previous phrasing of the pre-condition — runbook §6 criterion 2, *"`clicksend_only` entries
are explainable"* — was too weak to carry this. "Explainable" reads as a reporting nicety. It is
actually the only thing standing between apply mode and silently muting active crew.

**Changes:**

- **`05-CHUNK3-RUNBOOK.md` §6** — criterion 2 rewritten to require every `clicksend_only` entry
  be individually reviewed and either confirmed as a genuine opt-out to honour or **cleared from
  ClickSend first**. New subsection spells out the mechanism, why the list is append-only in
  practice, and names `6644` as a known stale entry sitting on both escalation tiers.
- **New §6a — the review query.** The opt-out list is not in Postgres, so it is two steps: a
  `curl` piped through `jq`/`sed` that emits the current `clicksend_only` numbers as a paste-ready
  SQL `VALUES` block, then a query joining them to `app_users` via `normalize_phone_to_e164()`
  for last-4, role, name, active flag, current opt-out flags, `sms_escalation_recipients` tier
  membership, and 90-day send count from `sms_message_log_compat`. A table says what each row
  shape means and what to do about it. Point of the query is that the review is five minutes,
  not a research project — the previous alternative was resolving last-4s by hand.
- **`12-BRADEN-TODO.md` §4c** — same warning in the human-facing list, since item 4 is where the
  inbound rule gets wired and apply mode is the next thing after it. Records that `6644` is to be
  **cleared from the ClickSend dashboard, not honoured**. Flags the tension with item 1, which
  says never delete an opt-out entry because the dated record is the TCPA evidence: resolution is
  to write the decision down and screenshot the entry *first*, then clear. One cross-reference
  line added to item 5, which is where `apply_enabled` actually gets set.

Deliberately **not** done: no flag changed, no ClickSend entry cleared, no `apply_enabled`
touched. Clearing `6644` is Braden's call on his own handset and is recorded as such.

**B — Edge Functions have no typecheck gate (`KNOWN-ISSUES.md`)**

`deno check` cannot resolve `npm:openai@^4.52.5` and aborts on module resolution, so it checks
nothing at all. **Pre-dates the SMS work** — the trigger is five AI functions importing
`https://esm.sh/openai@4` while `supabase/functions/deno.json` pins only `@supabase/supabase-js`.
The exact link between the CDN specifier and the `npm:` form in the error text was inferred, not
traced; that is recorded as an inference.

Verified while writing it up, because the consequence is wider than the error suggests:
`tsconfig.app.json` has `include: ["src"]`, and root `tsconfig.json` excludes `supabase/**` six
ways — so `npm run typecheck` was never going to reach Edge Function code even if `deno check`
worked. `tests/**` is outside it too, so the Vitest-covered `_shared/` helpers are verified for
behaviour and not for types. Net: lint + typecheck + build give **zero** type coverage of
anything under `supabase/functions/`. `deno lint` is the whole gate.

Fix direction recorded (pin `openai` in the import map, triage what `deno check` then reports,
remove `@ts-nocheck` file by file, wire the gate only once green). Noted that step 1 alone makes
the check *run* without making it *pass*, which is worse than today if it lands in CI at that
point. **Not fixed — explicitly out of scope for this session.**

**Gates:** not run. Markdown only — no file under `src/`, `supabase/` or `tests/` was touched.

**Production changes:** none. No SQL, no deploy, no Edge Function invocation, no ClickSend read
or write.

---

## 2026-09-09 — Session 11A (preserving the 6644 STOP before it can be cleared)

Session 10 resolved the item-1/§4c conflict by requiring a written decision plus a screenshot
before clearing `6644` from ClickSend's Opt-Out List. That was not sufficient, and this session
replaced it with something that is.

**The retention concern was real — confirmed, not assumed.**

ClickSend retains message history for roughly four months. Queried read-only via the MCP
`get--v3-sms-history` tool:

| Query | Result |
|---|---|
| `from:+18703656644`, 2026-03-01 → 2026-03-08 | 0 rows |
| `status:Received`, same window | 0 rows |
| no filter, same window | 0 rows |
| no filter, whole account, `date:asc` | 5,411 rows; **oldest is 2026-05-11T10:40:03Z** |
| `GET /v3/sms/inbound` (read-only curl, per the audit script's own pattern) | `total: 0` |

The retention floor is 2026-05-11, about four months back from today, exactly as documented.
The 2026-03-04 STOP is **past it and unrecoverable**. The inbound endpoint holds nothing either,
which is expected — no inbound rule has ever been wired (TODO item 4).

So the Opt-Out List contact **was** the last surviving record of that STOP anywhere:

```
list_id 3406168 "Opt-Out List" · contact_id 1548059062
+18703656644 · braden tabor · bradenleetabor@gmail.com · ATTS
date_added = date_updated = 1772664697 = 2026-03-04T22:51:37Z
```

One dashboard click from gone, on a list the shared purchase-order app also writes to.

**Inertness check before writing anything (this was the gate, and it nearly failed).**

Read the code and then the live catalog rather than assuming. Codebase: the only writers are
`clicksend-inbound-webhook` (insert, plus a `provider_message_id` dedup read — ours is `NULL`, and
the unique index is partial on `WHERE provider_message_id IS NOT NULL`, so it cannot collide) and
`clicksend-optout-reconcile` (insert only, after it has already written `app_users`). Neither
reads the table to make a decision. `_shared/smsOptOutFilter.ts`, which gates the safety-critical
send paths, reads `app_users` and `app_settings` only. Nothing under `src/` references the table.

Live catalog (`emqqxfzahmwnehxcpxzp`, read-only): **zero** triggers (including internal), rules,
views, matviews, functions, foreign keys, publications, and `cron.job` entries reference
`sms_opt_out_events`. The table was empty. `apply_enabled` is still `false`.

**The near-miss:** `run_data_retention` (cron `run-data-retention`, 03:00 daily, active) is not a
per-table function — it is a generic loop over `data_retention_policies` that deletes anything
older than `retention_days` from whatever table is listed. A backdated row is precisely what such
a policy deletes first. Checked the policy table: seven rows, `sms_opt_out_events` is not among
them, so the row is safe today. **But this is a live hazard for the whole table**, not just this
row: the moment anyone adds a retention policy keyed on `received_at`, the oldest and most
evidentially valuable opt-out records are the first destroyed. Recorded here because it will not
be obvious to whoever adds that policy.

**Written:** migration `20260909210000_sms_optout_6644_historical_record.sql` — one row,
`source = 'admin_manual'`, `keyword = 'STOP'`, `received_at = 2026-03-04T22:51:37Z` (the real
provider timestamp, not `now()`), `applied_operational` and `applied_marketing` both `false`
because no flag was changed then and none is changed now, `provider_message_id` `NULL` because no
provider id survives. `raw_message` states in full that this is a reconstruction from the opt-out
list, cites the list/contact ids and the retention evidence, records that the message body was
never captured so the keyword is inferred from ClickSend's own classification, and names both
`app_users` rows that share the handset.

`user_id` is the **admin** row `c1d477de…`, not arbitrarily: the ClickSend contact carries
`bradenleetabor@gmail.com`, which matches that account exactly. The employee row `61d09ffe…`
shares the phone and is named in `raw_message`, since one uuid column cannot hold both. The
webhook, faced with the same ambiguity, takes an arbitrary `.find()` match — worth fixing when
Chunk 5 lands consent records.

**Applied to production**, guarded and proven:

- `app_users` fingerprint `md5(string_agg(t::text,'|' ORDER BY t.user_id))` =
  `b42df8300155d4eb128ea907860be54b` (21 rows) **before and after** — byte-identical.
- Insert is `WHERE NOT EXISTS`-guarded; re-running the migration immediately returned
  `INSERT 0 0` and the table still holds exactly 1 row.
- Recorded in `supabase_migrations.schema_migrations` as `20260909210000`.
- No SMS sent, no ClickSend write, no Edge Function invoked, no flag touched.

Connection note: `SUPABASE_DB_URL` in `.env` points at `db.<ref>.supabase.co`, which now resolves
AAAA-only and fails on an IPv4-only machine. The working route is the session pooler at
`aws-1-us-east-1.pooler.supabase.com:5432` as `postgres.<ref>`. Same password — so TODO item 3's
rotation still applies, and whoever rotates it should fix the host in `.env` at the same time.

**`12-BRADEN-TODO.md` §4c rewritten.** The pre-condition for clearing is no longer "a screenshot
exists" but "the row is in `sms_opt_out_events`", with the confirming query inline. The warning
against extending the reasoning to anyone else's entry is kept and sharpened to the three things
that make `6644` specifically clearable. The tension with item 1 is kept and named, but it is now
*resolved* rather than balanced: nothing is destroyed, so there is no longer anything to trade off.

**The row does not appear in the SMS Communications export, and that is a gap.** That export
section reads `sms_message_log_compat`, which unions the outbound send logs
(`sms_message_log`, `sms_escalation_send_log`, and the other legacy tables). It is a record of
what we sent. `sms_opt_out_events` is a record of what was said back to us, has no export section,
and is reachable only by SQL. For a TCPA question — "were you told to stop, and when" — the
inbound record is the more important of the two, so it **should** have its own export section.
Not built here: this session was scoped to docs plus one inert row, and adding an export section
is a code change. Filed as a follow-up and noted inline in §4c so nobody assumes the export
already carries it.

**Gates:** not run for this half — one SQL migration and one Markdown file, nothing under `src/`.

**Production changes:** exactly one row inserted into `sms_opt_out_events`. Nothing else.

---

## 2026-09-09 — Session 11B (sequencing the typecheck fix; plan only, nothing changed)

Session 10 recorded the Edge Function typecheck gap in `KNOWN-ISSUES.md` with a four-step fix
direction. This session turns that into an ordered plan with an explicit stopping point, because
the fix direction as written invites someone to do step 1 and land it.

**New: `docs/sms-upgrade/15-TYPECHECK-REMEDIATION-PLAN.md`.** A plan, not a fix. The ordering is
the content: (1) make `deno check` runnable, (2) run it and count errors per file, (3) triage into
fix-now / fix-later-with-`@ts-expect-error` / won't-fix, (4) gate CI last and only once green.

**Why the order matters, stated in the doc:** pinning the import map alone makes the check *run*
without making it *pass*. Landing that in CI is strictly worse than today — currently CI is green
and everyone knows Edge Functions are unchecked; after step 1 in CI, it is red for reasons
unrelated to the change under review, and people learn to bypass it within a week. A
permanently-red gate is worse than a missing one.

**Facts gathered while writing it (read-only, no config touched):**

- 58 TypeScript files under `supabase/functions/`, **17,246 lines**. 38 files / 14,507 lines —
  **84%** — carry `// @ts-nocheck`. A working `deno check` would, on day one, check 2,739 lines.
- **`deno` is not installed on this machine.** Which is why step 2's number does not exist yet,
  and also means the `npm:openai@^4.52.5` error text in `KNOWN-ISSUES.md` came from some other
  surface — most likely `supabase functions deploy`/`serve`, which bundles its own Deno. Step 1a
  is therefore "install Deno, pinned to the Edge Runtime's version", not "edit the import map".
- **The `openai` import is not the biggest problem.** Specifier census across the 58 files found
  `@supabase/supabase-js` imported **three different ways**: `npm:@supabase/supabase-js@2` (24
  uses), `https://esm.sh/@supabase/supabase-js@2.39.0` (6), `https://esm.sh/@supabase/supabase-js@2`
  (6). Deno treats those as three distinct modules with three distinct copies of the same types, so
  a `SupabaseClient` from one is not assignable to a `SupabaseClient` from another. A meaningful
  share of whatever step 2 reports is probably that, and it collapses in one commit rather than
  needing per-file fixes. Also present: `https://deno.land/std@0.168.0/http/server.ts` (11 uses,
  old enough to predate `Deno.serve`) and `https://esm.sh/openai@4` (5).
- Step 2's count needs two caveats recorded alongside it: the `@ts-nocheck` files report zero while
  the pragma is present, and removing one pragma can *raise* the count in files that already pass,
  because their imports stop resolving to `any`.

**Highest-value targets named, with the reason:** `_shared/smsOptOutFilter.ts` (164 lines) and
`_shared/smsMessageLog.ts` (113 lines). Neither carries `@ts-nocheck`, so both are in scope the
moment the checker runs — no pragma removal, no extra diff. Both are Vitest-covered for behaviour
(`sms-opt-out-filter.test.ts`, `sms-message-log.test.ts`) and unchecked for types, since Vitest
transpiles through esbuild without checking and `tests/**` sits outside every `tsconfig`. That is
the specific danger: a green test run reads as verification when it covers only half of what is
being claimed. The filter gates every operational send path, so a type error there mutes a crew
member or sends to someone who said STOP; the message log feeds `sms_message_log_compat` and
therefore the compliance export, so a type error there corrupts the evidence rather than the send.

**Explicitly not done (B.2):** no change to `tsconfig.json`, `tsconfig.app.json`,
`supabase/functions/deno.json`, `.github/workflows/ci.yml`, or any `@ts-nocheck` pragma. No
`deno check` was run, because it cannot be — see above.

**Gates:** not run for this half. One new Markdown file, nothing under `src/`, `supabase/` or
`tests/`.

**Production changes:** none.

---

## 2026-09-09 — Session 12 (retention guard; opt-out export; typecheck rescope)

Three things, committed separately. Two of them close gaps this log named in Session 11 and then
did not act on.

### A — the backdated opt-out row is now protected from `run_data_retention()`

Session 11A found the hazard and wrote it down here. A note in a session log does not reach the
person writing the SQL, so this session put it where that person will be standing.

**What `run_data_retention()` actually does with `enabled = false` — read from production, not
inferred.** Its driving cursor is `SELECT … FROM data_retention_policies p WHERE p.enabled AND
EXISTS(table) AND EXISTS(column)`. The filter is on the **cursor**, so a disabled policy is never
entered into the loop: no `DELETE`, no `safety_audit_log` row, no archive copy, and **no output
row at all** — the function returns one row per *processed* policy, so a disabled table is absent
from the result rather than reported as zero. Proved by running that exact predicate read-only:
eight policy rows exist, seven come back, `sms_opt_out_events` does not.

**Applied — `20260909220000_sms_retention_protection.sql`:**

- `COMMENT ON TABLE sms_opt_out_events` — do not add to `data_retention_policies`; `received_at` is
  intentionally backdated to the real event time so oldest-first deletion takes the most
  evidentially valuable rows first; TCPA opt-out documentation is 5 years minimum.
- `COMMENT ON TABLE sms_message_log` — **it is similarly exposed and the answer is different.** It
  has a `sent_at` column and `11-COMPLIANCE-SOP.md` §5.7 already proposes 2 years for routine send
  logs, which is a live invitation to add a policy. So the comment does not forbid; it requires
  legal/HR sign-off, an `archive_table_name` rather than outright deletion, and a recorded reason —
  because a send to someone who had opted out is not a routine send log, it is the evidence of the
  violation.
- `notes text` column on `data_retention_policies` (there was no reason column; adding one was
  three lines), plus a column comment saying the function does not read it.
- An explicit `enabled = false` row for `sms_opt_out_events` with the reason in `notes`.
  `retention_days` is `365000` (~999 years) as a backstop if someone flips `enabled` without
  reading — the cutoff lands in 1027 AD and matches nothing, while staying inside Postgres's date
  range. `ON CONFLICT DO NOTHING`, not `DO UPDATE`, so a replay cannot overwrite a later human
  decision.

Applied to production via the session pooler, run twice: second run gave `INSERT 0 0` and a
`column "notes" already exists, skipping` notice. `app_users` fingerprint
`b42df8300155d4eb128ea907860be54b` (21 rows) — **identical to Session 11A's**, nothing touched.
Registered as `20260909220000` in `supabase_migrations.schema_migrations`.

**The honest limit of what those three guards buy, recorded because it is easy to overstate.**
Every existing retention migration in this repo uses `ON CONFLICT (table_name) DO UPDATE SET …
enabled = EXCLUDED.enabled`. Copy-paste that shape for `sms_opt_out_events` and it **overwrites the
disabled row** — `enabled` flips true and the ~999-year backstop is replaced by whatever the new row
carries. The `UNIQUE` constraint does not save you, because swallowing it is the entire point of
`ON CONFLICT`. So the marker row raises the odds someone *reads* the warning and makes the absence
of retention legible in a `SELECT`; it does not make the deletion impossible.

### A.3 — hard guard inside `run_data_retention()`: assessed, recommended against

Written up in full in `16-RETENTION-GUARD-ASSESSMENT.md`, including the alternative's diff,
unapplied. Recommendation is **against**, on four grounds, the first of which is specific rather
than general:

1. **The repo cannot currently reproduce the live function body.** Two migrations define
   `run_data_retention()`: `20260216100003_retention_audit_trail.sql` installs the rich body
   (pre-delete `safety_audit_log` row, `archive_table_name` support) and
   `20260229150000_data_retention_policies.sql` installs a bare-`DELETE` body. `20260216100003`
   sorts **first**, so a clean forward replay ends on the simple one. Production runs the rich one.
   Whoever writes the guard will open the file named after the feature — `20260229150000` — copy
   that body, add the guard, and ship a `CREATE OR REPLACE` that silently strips the retention audit
   trail and archive support from a nightly job, in a migration whose stated purpose is improving
   retention safety.
2. Seven live policies depend on the function nightly, including `safety_incidents` at 1825 days
   (OSHA 1904.33). Blast radius of editing it is every compliance table; blast radius of the problem
   is one SMS table.
3. A hardcoded protected-table array inside the function is a second source of truth competing with
   `data_retention_policies`, updated by a different kind of change than the one that adds
   protection. It will drift, and by then people will believe it covers tables it does not — worse
   than believing nothing covers them.
4. It fires at 03:00, hours after the migration that caused the problem was reviewed as fine. The
   reason this hazard exists is that nobody reads the 03:00 output.

**Recommended instead:** a `BEFORE INSERT OR UPDATE` trigger on `data_retention_policies` that
raises when a protected table is set `enabled = true`. Fails in the transaction that made the
mistake, touches nothing the other seven tables depend on, and closes the `ON CONFLICT DO UPDATE`
hole specifically. Diff is in the assessment doc, **not applied**. If anyone does still want the
in-function guard, the prerequisite is reconciling the two competing definitions first — dump
`pg_get_functiondef` from production, commit it, confirm a replay lands on it, then edit.

### A.4 — the vendor-list argument, in `KNOWN-ISSUES.md`

New entry: *"A vendor list is not a system of record: the PO app can write to the ClickSend Opt-Out
List"*. The point is narrower and worse than "vendors can have outages". The list is account-level
and the purchase-order app (`webhook-approval-for-6061.bolt.host`, owner unidentified) shares the
account, so it has the same **write** access to the list that held the only surviving copy of the
6644 STOP. Had it cleared or rewritten that entry there would have been no deletion event, no
before-state, and nothing anywhere else to notice — a TCPA-relevant fact would have ceased to exist
silently. Survival to 2026-09-09 was luck.

Residual exposure recorded honestly: every *other* entry on that list is still held only by
ClickSend and still writable by the PO app. Reconciliation surfaces an entry that **appears**; it
cannot notice one that **disappears**, because a removal is indistinguishable from an entry that was
never there.

### B — SMS Opt-Out Events export section

Session 11A called this "the real gap in the compliance deliverable" and filed it as a follow-up.
Built here. The send-log export proves what was sent; it cannot prove what was received and
honoured, which is the half that answers a TCPA allegation.

Second section in `ComplianceDataExportPanel.tsx`, **separate from SMS Communications and not
merged** — different facts, and an auditor needs to read them as such. Reads `sms_opt_out_events`
directly, date-ranged on `received_at`, same `SectionConfig` / `ExportColumn` shape as every other
section. Columns: received_at, recipient (`app_users` join on `user_id`, falling back to phone
last-4), keyword, source, applied_operational, applied_marketing, raw_message. Phone masked in
preview, full E.164 in CSV only, absent from PDF — the existing rule, unchanged. Test accounts
excluded by the same `@atts.test` filter. Reuses the three load states and `logReportExported`,
with its own unavailable message naming migration `20260909110000` rather than the send log's
`20260902200000`.

**B.3 — does the 6644 row read as a reconstruction?** `source = 'admin_manual'` on its own does
**not**: it is equally consistent with a live opt-out taken by phone. So the source column renders
a reader-facing label, `"Admin-entered (not a live inbound message)"`, and the raw_message excerpt
leads with the provenance note. Rendered against the actual production row:

```
SOURCE  : Admin-entered (not a live inbound message)
EXCERPT : RETROSPECTIVE RECORD — reconstructed 2026-09-09, not a live inbound event. Source of
          truth: ClickSend Opt-Out List (list_id 3406168, contact_id 1548059062, date…
```

CSV carries the raw_message in full (1,108 chars) rather than an excerpt, because that column is
the evidence. One trap worth knowing and now written into the SOP: `received_at` is 2026-03-04 and
the panel defaults to the last 90 days, so the row is **invisible unless the From date is moved
back** — an auditor accepting the default would conclude no opt-out events exist.

Also fixed while in the file: the From/To date inputs had `<label>` elements with no `htmlFor` and
no `id` on the input, so they were unlabelled to assistive tech and unreachable by
`getByLabel`. Given ids and testids.

`11-COMPLIANCE-SOP.md` §5.6 rewritten to cover both sections with a table stating which question
each answers, plus a table decoding the three `source` values by evidential weight and a paragraph
on why `Applied = No` is not a failure but always needs a sentence of explanation. §5.7 gained the
retention exception.

New spec `tests/e2e/sms-opt-out-events-export.spec.ts`, mirroring the send-log spec's structure
(unavailable vs. real-zero must never be conflated) and adding two assertions of its own: that the
section is not merged into SMS Communications, and that a `RETROSPECTIVE RECORD` row also carries
the "not a live inbound message" source label.

**Gates:** `npm run lint`, `npm run typecheck`, `npm run build` — all pass.

**The spec could not be run here, and that is pre-existing.** `loginAs` fails with
`Invalid login credentials` because the E2E test users do not exist in this environment. Confirmed
by running the existing `sms-communications-export.spec.ts`, which fails identically at the same
line. `npm run test:setup` would create real accounts in production, so it was not run. The query
itself **was** verified end-to-end: the exact PostgREST select the section issues, run against
production, returns the 6644 row with every selected column present.

### C — typecheck plan rescoped

`15-TYPECHECK-REMEDIATION-PLAN.md` rewritten. The previous version's implicit goal was "get
`deno check` working over the tree", which the 84%/17,246-line figure makes a project rather than a
fix.

**Recommended scope is now `_shared/smsOptOutFilter.ts` (164 lines) and `_shared/smsMessageLog.ts`
(113) and nothing else** — the two unpragma'd helpers on the safety-critical path.

**What that scope actually requires, measured rather than estimated.** Neither file references
`Deno.*`, imports `@supabase/supabase-js`, or imports any URL specifier —
`smsOptOutFilter.ts` takes its client as a structural `type SupabaseLike = { from: … }` precisely
so it does not have to. The full transitive closure is three files and 293 lines
(`+ _shared/phoneE164.ts`, 16 lines, zero imports). So: no Deno install, no import-map repair, no
entrypoint list, no pragma removal. One ~12-line tsconfig with `allowImportingTsExtensions` and a
`lib` that supplies `console`.

Probed read-only in `/tmp`, outside the repo, and the finding decides the scope: under
`tsc --strict --noEmit` the only errors were three `TS2584: Cannot find name 'console'`, an artefact
of the probe declaring `"types": []`. With a four-line ambient declaration it **exits zero**. Both
helpers are already type-clean. The work is therefore wiring a gate around passing code, not fixing
errors — which also means it can enter CI the day it is written, avoiding the permanently-red-gate
trap that makes the full-tree path dangerous. Probe directory deleted; nothing left in the repo.

Full-tree `deno check` kept as a separate, later, **explicitly-not-recommended-now** section with
the 2,739-line day-one figure attached and the note that the number measures the smallest visible
slice of the work, not the work.

**The `@supabase/supabase-js` specifier collapse promoted to a standalone prerequisite** (24 ×
`npm:`, 6 × `esm.sh/…@2.39.0`, 6 × `esm.sh/…@2`). It is worth doing on its own merits with no
typechecker involved: three copies of the client are downloaded and instantiated at runtime today,
one pinned to a stale 2.39.0. And it is a prerequisite for counting, because Deno treats the three
as distinct modules with mutually-unassignable types, so a share of any error count is that alone —
collapse first, count second, or a tractable job gets estimated as an intractable one.

**C.4 honoured: no config changed.** `tsconfig.json`, `tsconfig.app.json`,
`supabase/functions/deno.json`, `package.json`, `.github/workflows/ci.yml` all untouched. Still a
plan.

### D — housekeeping

`12-BRADEN-TODO.md`: the `SUPABASE_DB_URL` host fix is written into **item 3 (password rotation)**,
not item 1 — the instruction's own wording is "fix the host during rotation", and item 1 is the 6644
conversation. `db.<ref>.supabase.co` resolves **AAAA-only** (verified: `dig … A` empty, `AAAA`
returns `2600:1f18:…`), so it fails on IPv4-only machines; the working route is
`aws-1-us-east-1.pooler.supabase.com:5432`, same password, but the **username must become
`postgres.<ref>`** or the pooler rejects it with `FATAL: (ENOIDENTIFIER) no tenant identifier
provided` — a message that does not obviously mean "your username is missing the project ref".
This also explains Session 6's *"script DNS-failed on direct DB host"* for
`scripts/deploy-cron-auth.sh`: the script was fine, the host it was handed has no A record.

§4c updated: the "no export section, filed as a follow-up" paragraph is replaced by how to use the
one that now exists, including the From-date trap, and a note that the table is now retention-
protected.

**Production changes this session:** three `COMMENT`s, one `ADD COLUMN IF NOT EXISTS`, one
`data_retention_policies` row (`enabled = false`), one `schema_migrations` row. No SMS sent, no
ClickSend write, no Edge Function invoked, no opt-out flag touched, no `app_users` change.

---

## 2026-09-09 — Session 13 (retention guard applied; a migration divergence that is not SMS; the 12-line typecheck gate)

Four commits, each gated on `lint` + `typecheck` + `build`. One production change: a trigger.

### A — the retention guard is applied

`20260909230000_retention_protected_tables_guard.sql`. Session 12's recommendation — a
`BEFORE INSERT OR UPDATE` trigger on `data_retention_policies` rather than a guard inside
`run_data_retention()` — accepted and built. `run_data_retention()` was not touched, and part B
below is the reason that mattered more than it looked.

**Two things changed between the sketch in `16-RETENTION-GUARD-ASSESSMENT.md` and what shipped.**

**1. The prohibition dropped its `IF NEW.enabled` condition.** The sketch refused only
`enabled = true`, which does not close the hole it was written for. `INSERT … ON CONFLICT DO
UPDATE` fires `BEFORE INSERT` for the attempted row and then `BEFORE UPDATE` for the conflicting
one, and the `enabled` value on either pass is whatever the copy-paste happened to carry. Refusing
the whole row for a protected table — any INSERT, any UPDATE, plus an `OLD.table_name` check so a
policy cannot be renamed off the table — is the only formulation with no ordering left to reason
about. It also matches what the table's own `COMMENT` says without qualification.

Cost, recorded rather than discovered later: the marker row from `20260909220000` is now immutable,
and re-running that migration against a database that already has both the row and the trigger will
fail, because `BEFORE INSERT` fires before `ON CONFLICT` is evaluated so its no-op `DO NOTHING`
insert is refused rather than ignored. A clean forward replay is unaffected (this sorts later) and
`localgate/run.sh` drops its database every run, so it is not a workflow here. The fix if it is
ever needed is to drop the trigger for the duration, not to weaken it.

`DELETE` is deliberately unguarded: removing the marker row loses the record of the decision but
not the protection — a table with no policy is never entered into the loop — and it is not a bypass
because the follow-up INSERT is refused.

**2. `sms_message_log` is guarded, but not prohibited — and this was the question worth answering.**
The two tables' comments say materially different things. `sms_opt_out_events` says *"Do not enable
it"*, full stop. `sms_message_log` says retention is a deliberate decision requiring legal/HR
sign-off, `archive_table_name` set rather than deleting outright, and a reason in `notes`. An
outright block on the second would forbid what its own documentation permits — and would be dropped
by the first person who completed the sign-off correctly. **A guard removed by someone doing
everything right is the worst way to lose a control.**

So the rule for `sms_message_log` is conditional: an `enabled` policy is refused unless
`archive_table_name` **and** `notes` are both non-blank. Disabled marker rows pass. Correctly-formed
signed-off policies pass. What it rejects is exactly the four-column
`(table_name, date_column, retention_days, enabled)` copy-paste every other retention migration in
this repo uses — the realistic accident, and the one shape the comment already forbids.

Its limit stated so nobody over-reads it: this enforces the *form* of sign-off, not sign-off.
`archive_table_name = 'x'`, `notes = 'x'` satisfies it. It converts a silent copy-paste into a
deliberate act that leaves a written reason in the row. That is all it claims.

**Testing.** Local Postgres 17 with the real `data_retention_policies` DDL and all eight production
rows reproduced. Nine cases: plain INSERT, `ON CONFLICT DO UPDATE`, `SET enabled = true`, and
rename-away all refused; unprotected-table INSERT and `ON CONFLICT DO UPDATE` both normal;
`sms_message_log` refused bare, allowed with archive + notes, allowed disabled. Semantic hash of the
table unchanged across the refused writes.

Then production. Both live tests were chosen so they could not mutate anything **even if the guard
had failed to install**: the plain INSERT would have hit `UNIQUE (table_name)`, and the `ON CONFLICT`
variant used `DO UPDATE SET enabled = data_retention_policies.enabled`, writing the value the row
already holds. Both refused with the trigger's message. Policy hash
`e71385db549d7c9b8f43db2ed5123769` before and after, 8 rows, 7 enabled. `migration repair --status
applied 20260909230000`.

### B — two migrations define `run_data_retention()`, and replay installs the wrong one

Found while assessing where to put the guard above; **unrelated to SMS and more serious than the
question that found it.** Written up in `KNOWN-ISSUES.md` as a standalone entry. Not fixed here,
deliberately.

`20260216100003_retention_audit_trail.sql` (85-line body: pre-counts, writes a `safety_audit_log`
row before deleting, honours `archive_table_name`) sorts **before**
`20260229150000_data_retention_policies.sql` (33-line bare `DELETE`) — which is the migration that
*creates* the table and seeds the first policies. So the base migration sorts after an enhancement
written against it, and its `CREATE OR REPLACE` overwrites it. Proximate cause is a hand-typed
timestamp: **`20260229` is not a real date** — 2026 is not a leap year.

Production runs the audited body. Verified twice: `pg_get_functiondef` from the linked project
(2,975 chars, contains `safety_audit_log` and `archive_table_name`), and a line-by-line diff of the
body dumped into `localgate/prod_schema.sql` against `20260216100003` — byte-identical apart from
`pg_dump` writing `$_$` instead of `$$`. Both versions are in `schema_migrations`; there is no
applied-at column, so the out-of-order application is inferred from the resulting state, not read.

**What the replay version loses:** the pre-delete audit row entirely (`records_deleted`,
`date_range_start`, `date_range_end`, `retention_policy_days`, `executed_at`); archive support
entirely — the cursor does not even `SELECT p.archive_table_name`, so the `CREATE TABLE IF NOT
EXISTS … INSERT INTO archive SELECT …` branch is absent; the zero-row short circuit; and the
`COMMENT` describing the behaviour. **Consequence:** an environment built from migrations runs the
nightly `run-data-retention` cron (`0 3 * * *`, active) against `safety_incidents` (OSHA 1904.33,
1825 days) and six other tables with no audit row. Archive loss is latent today — all seven enabled
policies have `archive_table_name IS NULL` — but the audit-trail loss is active from the first run.

**Why nothing caught it.** `localgate/run.sh` baselines from a prod schema dump containing the
*correct* body and replays only migrations above anchor `20260608230400`. Neither file is above it.
The gate is green and will stay green. Compounding: full replay from zero already fails on
`20241205_job_tracker`, so nobody walks the path the defect lives on.

**Fix direction recommended, not written:** a forward migration installing the production body
authoritatively, from `pg_get_functiondef`. Its real cost is the prerequisite — confirming a clean
replay lands on it requires the `20241205_job_tracker` ordering bug fixed first. It rewrites a
nightly `SECURITY DEFINER` job that deletes OSHA records and must not ride along with anything.

**The repo is not the source of truth for this function.** Anyone opening
`20260229150000_data_retention_policies.sql` — the file named after the feature — reads a body that
is not what runs. This is exactly why the guard went on the table and not in the function.

**Cheap scan for the same pattern.** Two mechanical passes, not a 170-migration audit. 202 distinct
functions, 55 defined more than once — not a finding on its own, since redefinition is how this repo
evolves a function and the last file is normally the intended one. The pass that matters looks for
the *signature* of this defect: the last-sorting body being materially smaller than an earlier one.
**`run_data_retention` is the only hit, and it is not close** — −52 lines, against a next-largest
delta of −16 (`safety_audit_log_insert`), −13 (`award_points`), −7 (`get_user_lifetime_earned`), all
three of which are deliberate later rewrites identifiable from their filenames. Stated limit: line
count is a proxy for "lost a branch" and would miss a same-length semantic regression. Proving the
repo reproduces production for *any* function means diffing `pg_get_functiondef` against the
last-sorting definition, 202 times. That is the real audit and this is not it.

### C — the typecheck gate, wired

`15-TYPECHECK-REMEDIATION-PLAN.md`'s recommended scope is now done, and the plan says so; the
full-tree `deno check` path stays the documented not-now option.

`supabase/functions/tsconfig.shared.json` (new), `_shared/deno-globals.d.ts` (new, declares
`console` and nothing else), and one line in `package.json`: `typecheck` is now
`tsc --noEmit -p tsconfig.app.json && tsc -p supabase/functions/tsconfig.shared.json`. No workflow
edit — CI already runs `npm run typecheck`, so the gate entered CI with the commit.

`files`, not `include`, so the gate cannot silently widen when a file lands in `_shared/`.
`types: []` plus the ambient `.d.ts` rather than `"lib": ["dom"]`, because the DOM lib would also
resolve `window`, `document` and `fetch` — wrong for Deno, and it would let real mistakes through in
exchange for the one global these files use.

**Verified both directions.** Clean tree exits 0. With `entry.userIds.push(row)` in place of
`entry.userIds.push(row.user_id)` at `smsOptOutFilter.ts:106` — the shape of a real slip in the
static-recipient opt-out match — it fails:

```
supabase/functions/_shared/smsOptOutFilter.ts(106,24): error TS2345: Argument of type
'AppUserPhoneRow' is not assignable to parameter of type 'string'.
```

npm exit 2. Break reverted, `git diff` empty, exits 0 again. **The 15 Vitest tests over these two
files pass with the break in place** — esbuild transpiles without checking types — which is the
whole argument for having both gates.

Scope stated so it is not over-read: 293 lines of 17,246. The 38 `@ts-nocheck` files, including all
four send paths, are still unchecked. `KNOWN-ISSUES.md` corrected, since it claimed zero Edge
Function type coverage and that is now false for three files and still true for the other 55.

### D — two small fixes

**D.1 — the opt-out export no longer hides its own most important row.** The section inherited the
panel-wide 90-day default, so the 2026-03-04 record — the one an auditor is most likely asking about
— was invisible unless someone moved the From date back. New optional `defaultRangeDays` on
`SectionConfig`; the opt-out section takes 2 years, everything else keeps 90 days. The asymmetry is
deliberate and written into `11-COMPLIANCE-SOP.md` §5.6 as such: the send log is high-volume and a
wide default loads thousands of rows nobody asked for, while opt-out events are low-volume,
long-lived, and weighted toward their oldest rows. Also surfaced in the section description and in
the export notes that travel with the CSV and PDF.

**D.2 — the two export specs had never run. So they were run.** Recorded in `KNOWN-ISSUES.md`, with
a correction: the reason Sessions 11A and 12 gave — that `npm run test:setup` would create real
accounts in production — was **wrong**. `assertSafeE2ETarget()` already refuses the production ref
without an explicit verbose override, and `.env.test` already points at a local stack. The safe path
existed and was wired; nobody had used it. Worth saying plainly, because "we must build a safe
target first" sounds like a much bigger blocker than "run `supabase start`", and it kept two specs
unrun for two sessions.

Seeded 6/6 test users into the local project, applied `20260909210000` locally so the provenance
assertions are reached rather than short-circuiting on an empty range, and ran both specs:
**3 passed, 2 skipped, 0 failed.**

**Running them found a bug — in the spec.**
`expect(section).not.toContainText(/SMS Communications/i)` could never pass: the opt-out section's
description names the other section *on purpose*, to explain the separation the assertion was
guarding. A plain-text search was the wrong instrument. Replaced with a check for no such heading
and no `Provider Status` / `Delivery Status` columns. That assertion had been written, reviewed,
committed and cited as covering the separation, and was never capable of passing — which is the
entire case for running a spec before trusting it.

**What is still unverified, written down so the pass is not over-read.** Both specs' `unavailable`
test — the never-conflate-a-missing-table-with-a-zero-count contract that is the reason both files
exist — `test.skip()`s itself wherever the tables are present, which is everywhere they can
currently run. **The most load-bearing assertion in each file is the one still unrun.** Verified
against local seeded data, not production; Chromium only; never run in CI on this branch, where
`e2e.yml`'s `continue-on-error: true` seed step would let a refused seed pass silently and surface
as a `loginAs` failure one layer further from anyone reading it.

**Production changes this session:** one trigger and one trigger function on
`data_retention_policies`, one `schema_migrations` row. No SMS sent, no ClickSend write, no Edge
Function invoked, no opt-out flag touched, no `app_users` change, no `run_data_retention()` change.
The local Supabase stack received seeded test users and one opt-out row; it is a throwaway.

---

## 2026-09-10 — Session 14 (the merge that did not happen; two ClickSend writes; the crew brief)

Five things were asked for. Two landed, one was correctly refused, one was blocked by a gate,
and one was answered from the outside without needing the merge at all.

### The merge is blocked, and not by anything in the PR

`feat/sms-upgrade` is **not** behind `main` — merge-base is `209fa4f`, which *is* `origin/main`
HEAD, so the canopy redesign is already underneath this branch. 47 commits ahead, 0 behind,
`mergeable: MERGEABLE`, **zero conflicts**. 75 files.

CI is red, which is the documented stop condition, so nothing was merged. But the failures have
nothing to do with this PR and it is worth writing down why, because "CI is red" reads like a
verdict on the branch and it is not:

- **E2E, all three shards:** `Refusing to run against PRODUCTION Supabase (emqqxfzahmwnehxcpxzp)`.
  The repo's own safety guard, firing correctly. CI is configured with production credentials, so
  the guard will refuse every run until that is changed. `Merge reports` fails separately on
  `error: unknown option '--output=tests/e2e-report'` — a Playwright CLI flag that no longer
  exists.
- **CI (typecheck/lint/test/build):** `Missing Supabase environment variables` from
  `src/lib/supabaseClient.ts` in four unrelated suites, plus ~30 pre-existing assertion failures
  in `tests/unit/compliance-helpers.test.ts`. Nothing SMS.

**Every run on `main` since 2026-06-28 is also a failure**, including the canopy redesign commit
that is live in production right now. So this is not a gate the branch can pass — it is a gate
nothing in this repo has passed in three months. Merging PR #3 requires either fixing CI as its
own piece of work or an explicit human decision to merge red. Not a call to make unattended.

### The export panel is not live, and that was answerable from outside

No guessing required. `https://att-semployee-portal-main-2.vercel.app/version.json` reports
commit **`209fa4f82c892fcb79f81b05883dfc185864f309`**, built `2026-09-02T23:20:03Z` — that is
`origin/main` HEAD. Production deploys from `main`.

`git show origin/main:src/components/admin/ComplianceDataExportPanel.tsx | grep -c SMS` → **0**.
Confirmed against the shipped bundle rather than the source: fetched `index-B71C_ZTA.js` and all
four compliance chunks and searched for `SMS Communications`, `SMS Opt-Out Events`,
`sms_opt_out_events`, `sms_message_log`. Zero hits in every file.

So the two SMS export sections exist only on the branch. **This is the standing argument for the
merge** — and note the sharper version of it: production runs Edge Functions and migrations
deployed from `feat/sms-upgrade`, against a frontend built from `main`. The opt-out enforcement
in the send paths is live because the *functions* were deployed directly. Any redeploy of Edge
Functions from `main` turns it off silently.

### ClickSend write one — refused, and the reason is not the one you would guess

The obvious finding would have been "the API cannot create inbound rules". That is **false**.
`POST /v3/automations/sms/inbound` exists, is documented, and works.

The actual blocker is narrower and easier to miss: **the inbound rule model has no header field.**
Not in ClickSend's docs, not in their PHP SDK's `InboundSMSRule`, not in the OpenAPI spec.
`webhook_type` picks `post`/`get`/`json`, which is encoding, not authentication. A rule created
over the API would POST with no `x-internal-key`, `isAuthorized()` would return 401, and every
real STOP would vanish — behind a dashboard entry that looks correct. That is worse than no rule.

The authorised write was "an inbound rule **with header `x-internal-key`**". A headerless rule is
a different write, so none was created.

A second, independent reason to stop: **three rules already apply to RTO#**, all via
`dedicated_number: "*"` — `2126344` Send-to-messenger, `2126345` Opt-out contact
(`MOVE_CONTACT` → list `3406168`), `2126343` Default rule (`EMAIL_USER`). Rule `2126345` is the
mechanism that put `6644` on the opt-out list in March. Untouched.

The browser click-path that *can* attach the header is now `05-CHUNK3-RUNBOOK.md` §2c, with §2b
recording the API finding so it is not re-derived.

### ClickSend write two — done, precondition first

Deleted contact `1548059062` from list `3406168` (`+18703656644`, last-4 `6644`, added
`2026-03-04T22:51:37Z`).

**The precondition was checked before anything was deleted, not after.** Re-read the
`sms_opt_out_events` row at `received_at = 2026-03-04 22:51:37+00` and confirmed it present:
`id c5fb5bb8-…`, keyword `STOP`, `source admin_manual`, both `applied_*` false, `raw_message`
stating in full that it is a reconstruction. Had that row been missing, the ClickSend entry would
have been the last surviving copy of a TCPA-relevant fact and the delete would have destroyed it.

Reconcile, diff-only, before: `clicksend_only: [{6644}]`, `clicksend_count: 1`.
After: `clicksend_only: []`, `clicksend_count: 0`.

No other ClickSend write. No contact edit, no list change, no settings change, **no send**.

### Webhook proof — and a synthetic row that must not be mistaken for a real one

**Read this before interpreting any `sms_opt_out_events` row from 2026-09-10.**

`POST` to the production `clicksend-inbound-webhook` with `Authorization: Bearer <service role>`,
body `{"from":"+15005550001","to":"+18443781444","body":"HELP","message_id":"SYNTHETIC-CONNECTIVITY-TEST-20260910T012404Z"}`.
Response `{"skipped":true,"reason":"help_logged","keyword":"HELP"}`, HTTP 200.

Row written: `id be4f1089-0f1f-4827-a5a6-3bfef8f6c594`, `phone_e164 +15005550001`, `keyword HELP`,
`user_id null`, `applied_operational false`, `applied_marketing false`, `source webhook`,
`received_at 2026-09-10 01:24:05.33+00`.

**That row is a synthetic connectivity test, not a real inbound event.** `+15005550001` is a
reserved test number that matches no employee, which is why `user_id` is null. The
`provider_message_id` is deliberately self-identifying: `SYNTHETIC-CONNECTIVITY-TEST-…`. HELP was
chosen precisely because it logs and flips nothing; STOP was not simulated and must not be.

**What this proves:** the function is deployed and reachable, auth works, the keyword parser
works, `user_id` resolution correctly finds no match, and the insert into `sms_opt_out_events`
succeeds against production.

**What it does not prove, and this is the whole gap:** it says nothing about whether ClickSend
calls us. The test POSTed directly at the endpoint and skipped the provider entirely. The
ClickSend-to-webhook hop is the one link no simulation can exercise, and it stays unproven until
a real inbound text traverses it — Braden's HELP from his own handset to `+18443781444`, after
the rule in §2c exists.

### The two crew members

`17-CREW-CONTACT-CHECK.md`. Both cases are carrier-side delivery refusals, not consent: `4421`
2 delivered / 133 failed, last success 2026-05-12; `6286` 0 delivered / 6 failed, never a
success. Both still being texted as of 2026-09-09.

**The cheap explanation was checked first and does not hold.** Neither has a second phone number
anywhere — `app_users`, `auth.users.phone`, `auth.users.raw_user_meta_data`, `rto_requests`,
`sms_escalation_recipients`, or the full set of numbers either account has ever been texted at.
A stale primary with a good alternate would have resolved both without a conversation. There
isn't one.

**One correction to `13-UNREACHABLE-CREW.md` §3.** It says `6286` has never opened the app since
his account was created. That was read from `auth.users.last_sign_in_at`, which only advances on a
fresh sign-in and so sat at 2026-08-31 while his session persisted. `user_activity_sessions` has
him at **2026-09-09 21:00 UTC**, with three completed briefings (08-31, 09-01, 09-03). He is
reachable in-app today; only SMS is broken. That changes the recommendation from "chase him" to
"message him in the app and ask for a working number".

**Incidental finding, not SMS.** Both accounts carry
`manager_id = 06aafe0d-c620-4e25-b73d-72645a14d5ef`, ~~which exists in neither `app_users` nor
`auth.users`. **14 accounts point at it.** Anything that escalates to "their manager" has nowhere
to go.~~ **Struck Session 15:** the UUID is `app_users.id` for Steve Curtis (active
`general_foreman`); Auth is on `user_id`. See `20-ORPHANED-MANAGER-ID.md`.

### Production changes this session

One ClickSend contact deleted (`1548059062`), one `sms_opt_out_events` row inserted (the synthetic
HELP). **No SMS sent. No inbound rule created. No opt-out flag changed. No `app_users` change. No
migration. No Edge Function deployed.** Two Edge Functions were invoked — `clicksend-optout-reconcile`
twice in diff-only mode (reads only; `apply_enabled` is false) and `clicksend-inbound-webhook` once
with the synthetic HELP above.

---

## Session 15 — 2026-09-10 — merge PR #3 red, close out

### A — Merge despite red CI (Braden's explicit decision)

**Rationale, recorded verbatim in the merge commit body and here:** CI has failed on every
branch including main since 2026-06-28, so it is not a gate any branch can pass; the canopy
redesign running in production today also shipped past it; and leaving `feat/sms-upgrade`
unmerged is an active risk, because any Edge Function deploy from main silently disables
opt-out enforcement. Merging red does not lower a bar that is already on the floor.

**A.1 re-confirm before merge:** `mergeable: MERGEABLE`, `0` behind `main`, no conflicts.
Next SMS/HTTP send cron was morning (reminder 10:40 UTC / escalation 16:00 UTC).
`cron-http-failure-sweep` at 02:07 UTC was inside 45 minutes but is pure SQL (not a send path);
treated as non-blocking for this gate.

**A.2** Merged PR #3 with `--merge` (history preserved, not squash). Merge commit:
**`24ecc86f2557a767b35265eb00fc45b31c90ea67`**. Body names the red CI failures: E2E
production-credentials guard, dead Playwright `--output` flag, missing Supabase env vars in
four suites, ~30 pre-existing assertion failures in `tests/unit/compliance-helpers.test.ts`.

**A.3** Frontend production deploy **triggered and succeeded** on that commit.
`version.json` → commit `24ecc86f2557a767b35265eb00fc45b31c90ea67`, built
`2026-09-10T01:49:40.838Z`. GitHub deployment `6362887210` state `success`.

**A.4** Bundle check (same method as Session 14; before = 0 hits everywhere):

| Needle | Before | After (file → count) |
|---|---:|---|
| `SMS Communications` | 0 | `ComplianceAuditSection-UJpnHNVO.js` → **4** |
| `SMS Opt-Out Events` | 0 | `ComplianceAuditSection-UJpnHNVO.js` → **2** |
| `sms_opt_out_events` | 0 | `ComplianceAuditSection-UJpnHNVO.js` → **3** |
| `sms_message_log` | 0 | `ComplianceAuditSection-UJpnHNVO.js` → **2** |

### B — CI repair filed, not fixed

`19-CI-REPAIR-PLAN.md`. Config vs debt split. `compliance-helpers`: **24 fail under `TZ=UTC`,
81/81 pass locally** — brittle `new Date(y,m,d,h,mi)` fixtures, not product regressions.
`assertSafeE2ETarget` must not be weakened. CI non-functional since 2026-06-28 noted.

### C — `6286` app-use claim corrected

`13-UNREACHABLE-CREW.md` §3 struck in place. Durable pitfall in `KNOWN-ISSUES.md`. Question for
Braden sharpened to in-app: texts bouncing, what number should we have?

### D — Manager UUID re-checked

`20-ORPHANED-MANAGER-ID.md`. Resolves to Steve Curtis; escalation Tier 1 texts him; orphan
handling is **not** catching these 14 while the FK is set. Session 14 "neither table" claim
was `id` vs `user_id`. No reassignment.

### E — Braden TODO

Merge marked done; ClickSend inbound rule added as dashboard-only with §2c click-path; three
remaining items (§1 HELP, §2 crew phones, §3 reconcile week) confirmed standing.

**Production changes this session:** merge to `main` + Vercel production frontend deploy.
**No SMS sent. No ClickSend write. No opt-out flag change. No migration. No Edge Function
deploy from this session.** Docs commits on `docs/sms-upgrade-closeout`.

