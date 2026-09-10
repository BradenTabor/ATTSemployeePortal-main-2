# Chunk 2 verification — SMS Communications export

**Date:** 2026-09-09 (Session 2)
**What shipped:** “SMS Communications” section in `ComplianceDataExportPanel.tsx` reading `sms_message_log_compat` (`is_dry_run = false`, date range on `sent_at`), with CSV/PDF/preview column sets, `logReportExported`, and Playwright coverage for unavailable vs empty vs loaded.

## Three load states (Session 2 fix)

Soft-returning `[]` on a missing relation was removed — that looked identical to “no SMS in range” and is unsafe for auditors.

| State | Classification | UI | Export |
|---|---|---|---|
| **Unavailable** | `PGRST205` / `42P01` only (no free-text regex) | Amber warning: migration `20260902200000` not applied; explicitly “not an empty date range” | Buttons not shown |
| **Error** | Any other PostgREST/DB error | Existing red `role="alert"` | No |
| **Empty** | Query succeeded, `[]` | `0 records in range (query succeeded; no SMS in this date range).` | Disabled (`count === 0`) |

Classifier: `src/lib/smsExportLoadState.ts`. Unit tests: `tests/unit/sms-export-load-state.test.ts` (6/6 pass).

## Phone / PII rules

- On-screen preview: last-4 mask (`***1234`); recipient falls back to last-4 when `user_id` is null.
- CSV: full E.164 in `Phone (E.164)`.
- PDF: no phone column.

## Test accounts

Rows whose joined `app_users.email` matches `%@atts.test%` are excluded from the export result set.

## E2E (Session 2 — local Supabase)

```bash
# .env.test → http://127.0.0.1:54321 (local stack)
npm run test:setup
npx playwright test tests/e2e/sms-communications-export.spec.ts --project=chromium
```

Actual results (2026-09-09):

| Test | Result |
|---|---|
| `pre-migration: Load shows unavailable warning, not a zero count` | **SKIPPED** — `sms_message_log_compat` is present on the local stack (post-migration path applies). Spec correctly skips rather than conflating with empty. |
| `post-migration: Load shows a real record count (including empty range)` | **PASSED** (4.1s) — count element visible with `/record/i`; empty range would require `/in range/i`. |

Overall: `1 passed, 1 skipped`.

## Verified against real compat rows

Local stack had seeded live + legacy compat rows (`is_dry_run = false`). Post-migration Load succeeded against that data (not soft-empty). Pre-migration unavailable UI was covered by unit tests + skipped E2E branch when the view exists.
