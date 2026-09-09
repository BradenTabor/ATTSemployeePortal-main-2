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

