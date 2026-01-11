# Directive: DVIR + Equipment + JSA Compliance Check at 9:00 AM

> **⚠️ DEPRECATED**: This directive sends individual emails to each non-compliant user.
> 
> **Use `admin_compliance_summary_9am.md` instead**, which:
> - Sends a single consolidated email to ATTS Administration
> - Includes all three form types (DVIR, Equipment, JSA)
> - Provides better organization and readability
> - Sends via Gmail API with Make.com webhook backup

## Purpose
Identify employees and foremen who have not submitted their required daily forms (DVIR, Equipment Inspection, and/or Daily JSA) by the 9:00 AM cutoff and send them reminder notifications via Make.com webhook.

## Trigger
- **Scheduled**: Daily at 9:00 AM America/Chicago (Monday-Friday only)
- **Manual**: Can be invoked with a specific `dateFor` parameter for testing

## Required Inputs
| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFor` | string (YYYY-MM-DD) | Today in America/Chicago | The date to check compliance for |
| `cutoffLocal` | string (HH:MM) | "09:00" | Time cutoff in local timezone |
| `timezone` | string | "America/Chicago" | IANA timezone identifier |
| `dryRun` | boolean | from env | Skip sending webhooks |
| `notificationsEnabled` | boolean | from env | Enable/disable webhook sending |

## Data Sources

### Required Users
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

> **Note**: JSA uses `created_at` timestamp (converted to Chicago date) since there's no dedicated date field like DVIR's `report_date` or Equipment's `inspection_date`.

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

### Step 5: Compute Missing
For each required user, determine what forms are missing:

| Condition | Notification Type |
|-----------|-------------------|
| Missing DVIR, Equipment, AND JSA | `missing_all` |
| Missing DVIR AND Equipment only | `missing_dvir_equipment` |
| Missing DVIR AND JSA only | `missing_dvir_jsa` |
| Missing Equipment AND JSA only | `missing_equipment_jsa` |
| Missing DVIR only | `missing_dvir` |
| Missing Equipment only | `missing_equipment` |
| Missing JSA only | `missing_jsa` |
| All forms submitted | Compliant (no action) |

### Step 6: Create Notifications
For each missing user, attempt to insert into `compliance_notifications`:
- If duplicate (unique constraint violation) → skip (already notified)
- If new → proceed to webhook

### Step 7: Send Webhooks
If not `dryRun` and `notificationsEnabled`:
- POST to Make.com webhook with user data
- Update notification record with result

## Outputs

### compliance_runs Record
| Field | Value |
|-------|-------|
| run_type | "dvir_equipment_jsa_9am" |
| date_for | The date checked |
| cutoff_time | UTC timestamp |
| status | success/failed/skipped |
| required_user_count | Total required users |
| missing_dvir_count | Users missing DVIR |
| missing_equipment_count | Users missing equipment |
| missing_jsa_count | Users missing JSA |
| missing_all_count | Users missing all three |
| webhooks_sent | Successful webhook calls |
| webhooks_skipped | Skipped (duplicates/dry-run/weekend) |

### compliance_notifications Records
One per user per day per type (idempotent via unique constraint).

### Webhook Payload
```json
{
  "type": "compliance_reminder",
  "dateFor": "2026-01-08",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "John Smith",
    "role": "employee"
  },
  "missingType": "missing_all",
  "missingItems": [
    "DVIR (Daily Vehicle Inspection Report)",
    "Daily Equipment Inspection",
    "Daily JSA (Job Safety Analysis)"
  ],
  "appLink": "https://app.example.com/dashboard",
  "timestamp": "2026-01-08T15:00:00.000Z",
  "notificationId": "uuid"
}
```

## Error Handling

| Error | Action |
|-------|--------|
| Weekend day | Skip silently, return early |
| Database connection failed | Mark run as failed, log error |
| User fetch failed | Mark run as failed, log error |
| Webhook failed | Mark notification as failed, continue with others |
| Duplicate notification | Skip silently (expected behavior) |

## Idempotency Rules
1. **Run Level**: Multiple runs for same `dateFor` will create multiple `compliance_runs` records (audit trail)
2. **Notification Level**: Only one notification per `(dateFor, user_id, notification_type)` due to unique constraint
3. **Webhook Level**: Only sent for newly inserted notifications

## Acceptance Criteria
- [ ] Only runs on weekdays (Monday-Friday)
- [ ] Only employees and foremen with email are checked
- [ ] Checks all three form types: DVIR, Equipment, JSA
- [ ] Cutoff time is correctly converted to UTC
- [ ] Duplicate notifications are prevented
- [ ] All runs are logged in compliance_runs
- [ ] Dry-run mode skips webhooks but computes everything else
- [ ] Webhook payload matches expected schema
