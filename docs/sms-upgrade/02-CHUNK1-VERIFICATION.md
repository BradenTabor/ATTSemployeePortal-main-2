# Chunk 1 verification

**Date:** 2026-09-02
**What shipped:** `sms_message_log` + `sms_message_log_compat` + `sendAndLogSMS` / persist on all four send paths. `sendSMS()` POST URL, auth, and SUCCESS/THROTTLED handling unchanged.

## Unit tests

`npx vitest run --config tests/vitest.config.ts tests/unit/sms-message-log.test.ts`

- Builder matches provider results by index, parses price, snapshots opt-out, passes `run_id`.
- Dry-run helper sets `provider_status = DRY_RUN` and `is_dry_run = true`.
- Migration SQL contains UNION ALL of `sms_escalation_send_log`, `payroll_reminder_sms_log`, and `mass_sms_log` plus `is_admin()` RLS.

No Deno test runner exists in this repo; the logging helper is tested via Vitest (no jsr imports). An e2e against the compat view needs a live Postgres with the three legacy tables populated — not possible without applying the migration.

## Function dry-run (before/after eligible counts)

**Not run against production in this session.** Reasons:

1. Session constraint: do not apply the migration or deploy Edge Functions remotely. `sms_message_log` does not exist on `emqqxfzahmwnehxcpxzp` yet; a dry-run that writes unified rows would error on insert (send path still skipped).
2. `scripts/test-payroll-sms-reminder.sh` needs `SUPABASE_SERVICE_ROLE_KEY`. Invoking the **currently deployed** functions would measure the pre-Chunk-1 binary, not this branch.

**How to run after `db push` + function deploy (still dry-run only):**

```bash
# payroll — already has scripts/test-payroll-sms-reminder.sh
./scripts/test-payroll-sms-reminder.sh

# reminder (new dryRun on this branch)
curl -s -X POST "$URL/functions/v1/safety-briefing-reminder-sms" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# escalation
curl -s -X POST "$URL/functions/v1/safety-briefing-escalation-sms" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "x-dry-run: true" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# mass SMS remains dry-run by default (count preview; no unified rows without a message body)
curl -s -X POST "$URL/functions/v1/send-mass-sms" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

Record `eligible_count` / overdue / `countWithPhone` and sample bodies; they must match a pre-deploy dry-run of the same function.

## Code-level no-behavior-change checks

| Path | Recipient query changed? | Message body changed? | Live POST changed? |
|---|---|---|---|
| Reminder | SELECT added opt-out columns (not used as filters). New dryRun short-circuit; cron empty body still live. | No | No (`sendAndLogSMS` → `sendSMS`) |
| Escalation | Manager SELECT added `user_id` + opt-out columns (not used as filters). | No | No |
| Payroll | SELECT added marketing opt-out column (not used as filter). `x-dry-run` header now honored in addition to body. | No | No |
| Mass | SELECT added operational opt-out column (not used as filter). Recipients still skip marketing opt-out only. Still includes `@atts.test`. | No | No (`sendSMS` still used in the batch loop) |

Legacy tables: still written on live sends; still **not** written on dry-run (payroll claim RPC skipped; escalation/reminder skip legacy insert when `dryRun`).
