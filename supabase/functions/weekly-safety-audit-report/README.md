# Weekly Safety Audit Report

Runs every **Friday at 5:00 PM CST** (cron `0 23 * * 5`) to generate a weekly safety audit report, send an ATTS-branded HTML email to admins, log to `weekly_safety_reports`, and optionally append a summary row to Google Sheets.

## How it works

1. **Trigger:** pg_cron calls the Edge Function every Friday at 23:00 UTC (5 PM CST standard / 6 PM CDT).
2. **Date range:** Report covers the last 7 calendar days (e.g. last Friday through this Friday). Only **weekdays (Mon–Fri)** are used for compliance math.
3. **Data:** The function queries:
   - **Compliance:** RPC `get_compliance_summary_by_day(p_date_from, p_date_to)` for daily DVIR/Equipment/JSA counts; required users from `app_users` (role employee/foreman, email not null). Compliance % = (sum of distinct users who submitted per work day) ÷ (required users × work days) × 100. Top 5 non-compliant = users with most missing submissions (expected = work days × 3 per user).
   - **Incidents:** `safety_incidents` in range; by severity, type, site; OSHA recordable count; week-over-week trend.
   - **Hazards/defects:** `daily_jsa` (hazards_present), `dvir_reports` (checklists), `daily_equipment_inspections` (checklists); top 5 each; “out of service” = count of reports with at least one defect.
   - **Weather:** From `daily_jsa` (weather_conditions, weather_hazards); days with adverse weather and JSAs citing weather.
   - **Certifications:** `certification_records` — completed this week (certified_at in range), expiring in 30 days, overdue; week-over-week trend.
4. **Email:** Recipients from `email_recipient_lists` where `list_key = 'weekly_safety_audit'` (fallback if empty). Gmail SMTP sends HTML + plain text. Logged to `email_send_log`.
5. **DB:** One row inserted into `weekly_safety_reports` (week_start_date, week_end_date, report_data jsonb, email_sent, sheets_updated, error).
6. **Sheets (optional):** If `GOOGLE_SHEETS_*` is set, one summary row is appended to the sheet “Weekly Safety Audit Reports” (columns A–T). The same `weekly_safety_reports` row is then updated with `sheets_updated = true` on success.
7. **Admin UI:** Admin → Compliance Audit → “Weekly Reports” tab lists runs and expandable summary from `report_data`.

**Dry run:** Send body `{"dryRun": true}` to compute metrics and build HTML but skip email, DB insert, and Sheets.

## Env / secrets

- **Required for email:** `GMAIL_USER`, `GMAIL_APP_PASSWORD` (same as compliance cron).
- **Optional:** `ATTS_LOGO_URL`, `WEEKLY_SAFETY_REPORT_FALLBACK_RECIPIENTS` (comma-separated).
- **Optional (Google Sheets):** `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` (full JSON string), `GOOGLE_SHEETS_SAFETY_AUDIT_ID` (spreadsheet ID).

## Google Sheets setup (Phase 3)

1. Create a Google Cloud project, enable **Google Sheets API**, and create a **service account**. Download its JSON key.
2. Create a Google Sheet (or use an existing one). Add a sheet named exactly **`Weekly Safety Audit Reports`**.
3. Optional header row (row 1): Report Week Start | Report Week End | Generated At | DVIR Compliance % | JSA Compliance % | Equipment Compliance % | Active Users | Total Incidents | OSHA Recordable | Near Misses | First Aid Only | Out-of-Service Count | Certifications Completed | Certifications Expiring | Certifications Overdue | Top Hazard | Top Hazard Count | Top DVIR Defect | Top DVIR Defect Count | Report URL
4. Share the sheet with the service account email (e.g. `xxx@xxx.iam.gserviceaccount.com`) as **Editor**.
5. In Supabase: Project Settings → Edge Functions → Secrets. Set:
   - `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` = full contents of the service account JSON file (as a string).
   - `GOOGLE_SHEETS_SAFETY_AUDIT_ID` = the spreadsheet ID from the sheet URL (`/d/<ID>/edit`).

If these are not set, the function still runs and sends email; it only skips the Sheets append and logs a warning.

## Testing

- **Dry run (no email, no DB, no Sheets):**
  ```bash
  curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/weekly-safety-audit-report \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"dryRun": true}'
  ```
- **Full run:** same URL and headers with `-d '{}'` or no body.

## Cron

Scheduled in migration `20260302000002_schedule_weekly_safety_audit_report.sql`. Replace `SERVICE_ROLE_KEY_PLACEHOLDER` in that migration (or in Supabase SQL) with your service role key.
