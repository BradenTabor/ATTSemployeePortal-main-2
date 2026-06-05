# Payroll Hours Reminder SMS

**Production status:** Live on `emqqxfzahmwnehxcpxzp` — `payroll_reminder_sms_config.enabled = true`, crons active Thu–Sat 8 AM CT (~21 recipients per run).

Automated SMS every **Thursday, Friday, and Saturday at 8:00 AM America/Chicago**, reminding active employees to submit payroll hours before Saturday. Sent via **ClickSend** from Edge Function `payroll-hours-reminder-sms`.

## Schedule

| Day (Central) | Tier | Tone |
|---------------|------|------|
| Thursday | 1 | Friendly reminder |
| Friday | 2 | Due tomorrow — please submit today |
| Saturday | 3 | Deadline today |

**DST:** Transitions occur at 2:00 AM on Sundays in March and November. This schedule runs Thu–Sat at 8:00 AM CT only, so transition days never affect delivery. Two pg_cron jobs (`payroll-hours-reminder-sms-utc14` at 14:00 UTC, `payroll-hours-reminder-sms-utc13` at 13:00 UTC) both call the same function; an in-function **wall-clock guard** (`isEightAmChicago`) ensures only the invocation at true 8:00 AM Central sends.

**Company calendar:** Thu and Fri runs skip when `company_calendar` has today’s date. **Saturday always sends** (deadline day).

## Recipients

- All **active** `app_users` with a normalizable phone number
- Every role (employee through admin)
- Excludes: `@atts.test` emails, `sms_operational_opt_out = true`, invalid phones after `toE164()`

Payroll submission is an external Google Form; the app cannot detect who has submitted — each run is a broadcast.

## Message rules

- GSM-7 only (no `→`, no URLs)
- Max 160 characters (single segment)
- Personalization: `getFirstName(app_users.full_name)` — same logic as `safety-briefing-reminder-sms`
- Includes: `Reply STOP to opt out.`

## HTTP response codes

All expected skips return **HTTP 200** with `{ skipped: true, reason }` so pg_cron does not log false failures:

- Not 8 AM Central (wrong UTC slot)
- Disabled via `app_settings.payroll_reminder_sms_config`
- Company calendar (Thu/Fri)
- Not Thu/Fri/Sat
- Already sent / in progress

Auth failures: **401**. DB/ClickSend failures: **500**.

## Kill switch

```sql
UPDATE app_settings
SET value = '{"enabled": false}'::jsonb
WHERE key = 'payroll_reminder_sms_config';
```

## Dry run (side-effect-free)

No log row, no SMS, no idempotency slot consumed:

```bash
curl -s -X POST "https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/payroll-hours-reminder-sms" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

Returns `eligible_count`, exclusions, and `sample_messages`.

## force_day (testing)

Service role only. Bypasses wall-clock guard and day-of-week. Sets tier directly (`1` = Thu copy, `2` = Fri, `3` = Sat).

```bash
curl -s -X POST ".../payroll-hours-reminder-sms" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"force_day":1}'
```

**Re-test same day:** A successful run writes `date_checked = today`, `tier = force_day`, `success = true`. Re-running the same `force_day` that day skips via idempotency (correct). To re-test:

```sql
DELETE FROM payroll_reminder_sms_log
WHERE date_checked = CURRENT_DATE AND tier = 1;  -- use 1, 2, or 3
```

## Recovery (manual fallback)

Auto-recover reclaims rows where `success = false` and `sent_at` older than 15 minutes. If stuck:

```sql
DELETE FROM payroll_reminder_sms_log
WHERE date_checked = 'YYYY-MM-DD'  -- Chicago date
  AND tier = 1
  AND success = false;
```

## STOP / operational opt-out

- **Carrier (ClickSend):** Recipients can reply STOP; ClickSend blocks future delivery at the carrier level.
- **App (`sms_operational_opt_out`):** Admin sets `true` on `app_users` to exclude from operational SMS.

**Inbound STOP gap (v1):** When a recipient replies STOP, ClickSend blocks delivery, but the app does **not** automatically set `sms_operational_opt_out = true` (no inbound webhook yet). The function may still include the user in batches; audit may show send attempts, but **no SMS is delivered** to STOP-blocked numbers. Admin must set the flag manually when notified.

**Follow-up:** ClickSend inbound webhook → auto-set `sms_operational_opt_out`.

## Cost (approve before first live week)

### 1. Eligible recipients

```sql
SELECT COUNT(*) AS eligible_recipients
FROM app_users
WHERE status = 'active'
  AND COALESCE(sms_operational_opt_out, false) = false
  AND phone_number IS NOT NULL AND trim(phone_number) <> ''
  AND email NOT ILIKE '%@atts.test%';
```

Dry-run `eligible_count` may be slightly lower after `toE164()` normalization.

### 2. Phone diagnostic (before migration)

```sql
SELECT
  COUNT(*) FILTER (WHERE phone_number IS NOT NULL) AS have_phone,
  COUNT(*) FILTER (WHERE phone_number ~ '^\+?[0-9]{10,15}$') AS regex_pass,
  COUNT(*) FILTER (
    WHERE phone_number IS NOT NULL AND phone_number !~ '^\+?[0-9]{10,15}$'
  ) AS regex_fail
FROM app_users
WHERE status = 'active';
```

### 3. Historical per-message price

```sql
SELECT
  ROUND(AVG(total_price / NULLIF(recipient_count, 0))::numeric, 4) AS avg_usd_per_message,
  SUM(total_price) AS spend_90d,
  SUM(recipient_count) AS messages_90d
FROM sms_escalation_send_log
WHERE recipient_count > 0
  AND sent_at > now() - interval '90 days';
```

### 4. Annual estimate

```
messages_per_year = N × 3 × 52
annual_usd        = messages_per_year × P × 1 segment
```

Example: N=22, P=$0.024 → ~$82.37/year (replace with your SQL results).

### Approval checklist

- [ ] Phone diagnostic → `regex_fail = ___`
- [ ] Eligible recipients → **N = ___**
- [ ] Avg price or ClickSend dashboard → **P = $___/segment**
- [ ] Annual cost **N × 156 × P = $___**
- [ ] ClickSend balance OK for first month (~N × 3 × P)
- [ ] Dry-run `eligible_count` matches SQL (± normalization)
- [ ] `deploy-cron-auth.sh` run after migration
- [ ] `payroll_reminder_sms_config.enabled = true`

## Deploy

1. `supabase functions deploy payroll-hours-reminder-sms --no-verify-jwt`
2. Apply migration `20260521120000_payroll_hours_reminder_sms.sql` (or `psql $SUPABASE_DB_URL -f ...`)
3. Configure cron Bearer keys (`./scripts/deploy-cron-auth.sh` or payroll-only SQL in deploy section)
4. `./scripts/test-payroll-sms-reminder.sh` — dry-run + idempotency checks (no SMS)
5. Enable after cost approval (`payroll_reminder_sms_config.enabled`)

## Automated tests

```bash
./scripts/test-payroll-sms-reminder.sh
```

Optional live SMS to all recipients (only when ready):

```bash
RUN_LIVE=1 ./scripts/test-payroll-sms-reminder.sh
```

## Tables

- `payroll_reminder_sms_log` — audit + idempotency
- `app_users.sms_operational_opt_out` — app-side exclusion
- RPC `claim_payroll_reminder_sms_log(date, tier)` — crash-safe slot claim
