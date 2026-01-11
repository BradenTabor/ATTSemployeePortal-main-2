# Directive: Admin Compliance Summary Email at 9:00 AM

## Purpose
Generate a consolidated compliance summary email listing all employees and foremen who have not submitted their required daily safety forms (DVIR, Equipment Inspection, and Daily JSA) by the 9:00 AM cutoff. Send this summary to ATTS Administration via Gmail API and Make.com webhook.

## Trigger
- **Scheduled**: Daily at 9:00 AM America/Chicago, Monday through Friday only
- **Manual**: Can be invoked with a specific `dateFor` parameter for testing

## Required Inputs
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFor` | string (YYYY-MM-DD) | Today in America/Chicago | The date to check compliance for |
| `cutoffLocal` | string (HH:MM) | "09:00" | Time cutoff in local timezone |
| `timezone` | string | "America/Chicago" | IANA timezone identifier |
| `dryRun` | boolean | from env | Skip sending emails/webhooks |
| `notificationsEnabled` | boolean | from env | Enable/disable email sending |

## Email Configuration
| Setting | Value |
|---------|-------|
| **FROM** | `allterraintreeservice.po@gmail.com` |
| **TO** | `bradenleetabor@gmail.com`, `shane@alltts.com`, `dusty@alltts.com`, `mike@alltts.com`, `weston@alltts.com`, `steve@alltts.com` |
| **Subject** | `[ATTS] Daily Safety Form Compliance Report - {dateFor}` |
| **Primary Send** | Gmail API via Nodemailer |
| **Secondary Send** | Make.com Webhook (backup/audit) |

## Data Sources

### Required Users (Roster)
```sql
SELECT user_id, email, full_name, role
FROM public.app_users
WHERE role IN ('employee', 'foreman')
  AND email IS NOT NULL;
```

### DVIR Submissions
```sql
SELECT user_id
FROM public.dvir_reports
WHERE report_date = :dateFor
  AND created_at < :cutoffUtc;
```

### Equipment Inspections
```sql
SELECT user_id
FROM public.daily_equipment_inspections
WHERE inspection_date = :dateFor
  AND created_at < :cutoffUtc;
```

### Daily JSA Submissions
```sql
SELECT user_id
FROM public.daily_jsa
WHERE timezone('America/Chicago', created_at)::date = :dateFor
  AND created_at < :cutoffUtc;
```

## Logic

### Step 1: Check Weekday
Only run Monday through Friday. Skip silently on weekends.

### Step 2: Determine Cutoff Time
Convert `dateFor` + `cutoffLocal` in `timezone` to UTC timestamp for comparison with `created_at`.

### Step 3: Fetch Required Users
Query `app_users` for employees and foremen with valid emails.

### Step 4: Fetch Submissions
Query all three tables for submissions on `dateFor` before cutoff:
- DVIR submissions (by `report_date`)
- Equipment inspections (by `inspection_date`)
- Daily JSA submissions (by `created_at` date in America/Chicago)

### Step 5: Compute Non-Compliant Users
For each required user, determine what forms are missing:
- `missing_all` - Missing DVIR, Equipment, AND JSA
- `missing_dvir_equipment` - Missing DVIR AND Equipment only
- `missing_dvir_jsa` - Missing DVIR AND JSA only
- `missing_equipment_jsa` - Missing Equipment AND JSA only
- `missing_dvir` - Missing DVIR only
- `missing_equipment` - Missing Equipment only
- `missing_jsa` - Missing JSA only
- Compliant users (submitted all three) are excluded from report

### Step 6: Generate Email Content
Create a well-formatted email with:
1. Header with report title and date
2. Summary statistics (total required, compliant, non-compliant counts)
3. Non-compliant users grouped by missing form type
4. Timestamp of report generation
5. Professional closing message

### Step 7: Send Email (Dual Send)
1. **Primary**: Send via Gmail API using Nodemailer
   - FROM: `allterraintreeservice.po@gmail.com`
   - TO: All 6 admin recipients
2. **Secondary**: POST email data to Make.com webhook for audit trail

### Step 8: Log Results
Record the compliance run in `compliance_runs` table with:
- Summary statistics
- Send status (Gmail and webhook)
- Any errors encountered

## Email Format

```
=================================================================
          ATTS DAILY SAFETY FORM COMPLIANCE REPORT
=================================================================

Date: {dateFor formatted}
Report Generated: {timestamp} CST

-----------------------------------------------------------------
                         SUMMARY
-----------------------------------------------------------------
Total Required Employees: {count}
Compliant: {count}
Non-Compliant: {count}

-----------------------------------------------------------------
               NON-COMPLIANT EMPLOYEES
-----------------------------------------------------------------

MISSING ALL FORMS (DVIR, Equipment Inspection, Daily JSA):
  1. {Full Name} ({role}) - {email}
  2. ...

MISSING DVIR AND EQUIPMENT INSPECTION:
  3. {Full Name} ({role}) - {email}
  ...

[Additional sections for each missing combination]

-----------------------------------------------------------------

This report was generated on {full timestamp}.

Thank you for reviewing this compliance report.
Please follow up with the listed employees as needed.

ATTS Safety Compliance System
=================================================================
```

## Webhook Payload Schema
```json
{
  "type": "admin_compliance_summary",
  "dateFor": "2026-01-08",
  "generatedAt": "2026-01-08T15:00:00.000Z",
  "summary": {
    "totalRequired": 25,
    "totalCompliant": 18,
    "totalNonCompliant": 7,
    "missingDvirCount": 3,
    "missingEquipmentCount": 2,
    "missingJsaCount": 4,
    "missingAllCount": 1
  },
  "nonCompliantUsers": [
    {
      "userId": "uuid",
      "email": "user@example.com",
      "fullName": "John Smith",
      "role": "employee",
      "missingForms": ["DVIR", "Equipment Inspection", "Daily JSA"],
      "missingType": "missing_all"
    }
  ],
  "emailContent": {
    "subject": "[ATTS] Daily Safety Form Compliance Report - 2026-01-08",
    "textBody": "...",
    "htmlBody": "..."
  },
  "sendResults": {
    "gmail": { "success": true, "messageId": "..." },
    "webhook": { "success": true }
  }
}
```

## Error Handling

| Error | Action |
|-------|--------|
| Weekend day | Skip silently, return early with `skipped: true` |
| Database connection failed | Mark run as failed, log error |
| User fetch failed | Mark run as failed, log error |
| Gmail send failed | Log error, continue with webhook send |
| Webhook failed | Log error, don't fail entire run if Gmail succeeded |
| No non-compliant users | Send "All Clear" email variant |

## Idempotency Rules
1. **Run Level**: Multiple runs for same `dateFor` create multiple `compliance_runs` records (audit trail)
2. **Email Level**: Each run sends a fresh email (no deduplication at email level)
3. **Safe to re-run**: Running multiple times for the same day is safe - it just sends multiple summary emails

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `GMAIL_USER` | Yes | Gmail address to send from |
| `GMAIL_APP_PASSWORD` | Yes | 16-character Gmail App Password |
| `ADMIN_EMAIL_RECIPIENTS` | Yes | Comma-separated list of admin emails |
| `MAKE_WEBHOOK_URL` | Yes | Make.com webhook URL |
| `DRY_RUN` | No | Set to `true` to skip actual sending |
| `EMAIL_NOTIFICATIONS_ENABLED` | No | Set to `false` to disable all notifications |

## Acceptance Criteria
- [ ] Only runs on weekdays (Monday-Friday)
- [ ] Checks all three form types: DVIR, Equipment, JSA
- [ ] Only employees and foremen with email are checked
- [ ] Cutoff time is correctly converted to UTC
- [ ] Email is well-formatted and readable
- [ ] Gmail send works with App Password authentication
- [ ] Webhook receives complete payload for audit
- [ ] All runs are logged in compliance_runs
- [ ] Dry-run mode computes everything but skips actual sending
- [ ] "All Clear" email sent when everyone is compliant

