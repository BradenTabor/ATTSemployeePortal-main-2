# Directive: Admin Compliance Summary (9 AM)

## Goal

At 9:00 AM America/Chicago on weekdays, determine which employees (roles `employee`, `foreman`) have not submitted required DVIR, Daily Equipment Inspection, and Daily JSA for "today," then send a single consolidated email to ATTS Administration and optionally trigger a Make.com webhook for audit/Sheets logging.

## Inputs

- **Time trigger**: 9:00 AM America/Chicago, Monday–Friday.
- **Date for compliance**: "Today" in configured timezone (`TIMEZONE`, default `America/Chicago`).
- **Environment**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ADMIN_EMAIL_RECIPIENTS`, `MAKE_WEBHOOK_URL` (optional), `COMPLIANCE_CUTOFF` (optional, default `09:00`), `EMAIL_NOTIFICATIONS_ENABLED`, `DRY_RUN`.

## Tools / Scripts

- **Execution**: `src/services/safety-agent/execution/checkAdminCompliance9am.ts`
  - `checkAdminCompliance9am()` – returns list of required users and who is missing which forms.
- **Email**: `execution/sendAdminSummaryEmail.ts` – builds HTML/text body, sends via Gmail SMTP, optionally calls Make webhook.
- **Orchestration**: Edge Function `admin-compliance-cron` invokes the execution script (orchestration vs execution; naming can be clarified).

## Outputs

- **Email**: One email to all `ADMIN_EMAIL_RECIPIENTS` with non-compliant users and missing forms (DVIR, Equipment, JSA).
- **Webhook**: POST to Make.com with payload for Google Sheets / audit log (if configured).
- **Database**: Optional `compliance_runs` (or equivalent) row for run metadata and audit.

## Business Rules

1. **Eligible users**: Only users with role `employee` or `foreman` are required to submit; others are excluded.
2. **Weekdays only**: No run on Saturday/Sunday (use `isWeekday(dateFor, timezone)`).
3. **Cutoff**: Submissions count if created/updated before 9:00 AM (or `COMPLIANCE_CUTOFF`) on the same calendar day in the configured timezone.
4. **One email per run**: Single consolidated admin summary; no per-user emails from this flow (legacy per-user flow is deprecated).

## Edge Cases

- **No non-compliant users**: Send email stating "All required users are compliant" (or skip email per config).
- **Gmail failure**: Log error; retry logic recommended (not yet implemented). Consider queueing or alerting.
- **Missing env (e.g. ADMIN_EMAIL_RECIPIENTS)**: Log and skip send; do not throw if in dry-run mode.
- **Duplicate run**: Idempotent by (date_for, run_type). If a run already recorded for today, avoid duplicate emails (or allow if intentional re-run).
- **RLS / service role**: Use service role so all required user and submission data are readable regardless of RLS.

## Acceptance Criteria

- [ ] Run executes at 9 AM CST on weekdays only.
- [ ] Only `employee` and `foreman` are checked for DVIR, Equipment, JSA.
- [ ] Admin email lists each non-compliant user and which forms are missing.
- [ ] Make webhook called when configured; payload matches audit expectations.
- [ ] No per-user compliance emails from this flow (consolidated only).
