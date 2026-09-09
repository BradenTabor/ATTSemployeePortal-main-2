# Chunk 2 verification — SMS Communications export

**Date:** 2026-09-09
**What shipped:** “SMS Communications” section in `ComplianceDataExportPanel.tsx` reading `sms_message_log_compat` (`is_dry_run = false`, date range on `sent_at`), with CSV/PDF/preview column sets, `logReportExported`, and Playwright empty-state coverage.

## Cannot verify against real rows yet

The panel **cannot** be verified against real SMS rows until `20260902200000_sms_message_log.sql` is applied to a Supabase project. Until then:

- Fetch soft-returns `[]` if PostgREST reports the relation missing (so Load does not hard-fail empty-state / pre-migration environments).
- E2E covers the **empty-state path** only: admin opens Data Export → SMS section renders → Load over a date range completes without error and shows a record count.

## Phone / PII rules

- On-screen preview: last-4 mask (`***1234`); recipient falls back to last-4 when `user_id` is null.
- CSV: full E.164 in `Phone (E.164)`.
- PDF: no phone column.

## Test accounts

Rows whose joined `app_users.email` matches `%@atts.test%` are excluded from the export result set.

## E2E

```bash
npx playwright test tests/e2e/sms-communications-export.spec.ts --project=chromium
```
