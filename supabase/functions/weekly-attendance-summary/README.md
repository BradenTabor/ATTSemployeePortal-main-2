# weekly-attendance-summary

Supabase Edge Function that sends a **weekly attendance summary email** every Monday morning with the previous work week’s attendance data (Mon–Fri).

## Schedule

- **Cron:** `0 12 * * 1` (every Monday at 12:00 UTC)
- **Local time:** 7:00 AM CDT / 6:00 AM CST (America/Chicago)

## Env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `GMAIL_USER` | Yes (for sending) | Sender email (e.g. `allterraintreeservice.po@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Yes (for sending) | Gmail app password |
| `ATTS_LOGO_URL` | No | URL for logo image in email header |
| `WEEKLY_ATTENDANCE_SUMMARY_FALLBACK_RECIPIENTS` | No | Comma-separated emails if no recipients in `email_recipient_lists` for `weekly_attendance_summary` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set by the Supabase runtime.

## Dry run

To build the report and return JSON **without** sending email or writing to `email_send_log`:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/weekly-attendance-summary" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{"dryRun": true}'
```

Response includes `startDate`, `endDate`, `startDisplay`, `endDisplay`, `employeeCount`, `totalPresent`, `overallRate`, `emailSent: false`, and `durationMs`.

## Local testing

1. Start Supabase (e.g. `supabase start`) and serve functions:
   ```bash
   supabase functions serve weekly-attendance-summary
   ```

2. Invoke with dry run (no email):
   ```bash
   curl -X POST "http://localhost:54321/functions/v1/weekly-attendance-summary" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <ANON_OR_SERVICE_ROLE_KEY>" \
     -d '{"dryRun": true}'
   ```

3. To test real send, use `"dryRun": false` and ensure `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set in the function’s env (e.g. Supabase Dashboard → Edge Functions → weekly-attendance-summary → Secrets).

## Recipients

Recipients are read from `email_recipient_lists` where `list_key = 'weekly_attendance_summary'`. Admins manage this list in the app under **Email Recipients** → **Weekly Attendance Summary**. If the list is empty, the function uses `WEEKLY_ATTENDANCE_SUMMARY_FALLBACK_RECIPIENTS` when set.

## Date range

The report always covers the **previous full work week** (Monday–Friday). Date math uses **America/Chicago**. If the function runs on a day other than Monday (e.g. manual trigger or retry), it still uses the most recent Monday strictly before “today” and that Friday.
