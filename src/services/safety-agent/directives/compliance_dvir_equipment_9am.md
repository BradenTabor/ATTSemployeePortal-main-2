# Directive: DVIR + Equipment Compliance Check at 9:00 AM

## Purpose
Identify employees and foremen who have not submitted their required daily forms (DVIR and/or Equipment Inspection) by the 9:00 AM cutoff and send them reminder notifications via Make.com webhook.

## Trigger
- **Scheduled**: Daily at 9:00 AM America/Chicago
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

## Logic

### Step 1: Determine Cutoff Time
Convert `dateFor` + `cutoffLocal` in `timezone` to UTC timestamp for comparison with `created_at`.

### Step 2: Fetch Required Users
Query `app_users` for employees and foremen with valid emails.

### Step 3: Fetch Submissions
Query both tables for submissions on `dateFor` before cutoff.

### Step 4: Compute Missing
For each required user:
- If no DVIR and no equipment → `missing_both`
- If no DVIR only → `missing_dvir`
- If no equipment only → `missing_equipment`
- Otherwise → compliant (no action)

### Step 5: Create Notifications
For each missing user, attempt to insert into `compliance_notifications`:
- If duplicate (unique constraint violation) → skip (already notified)
- If new → proceed to webhook

### Step 6: Send Webhooks
If not `dryRun` and `notificationsEnabled`:
- POST to Make.com webhook with user data
- Update notification record with result

## Outputs

### compliance_runs Record
| Field | Value |
|-------|-------|
| run_type | "dvir_equipment_9am" |
| date_for | The date checked |
| cutoff_time | UTC timestamp |
| status | success/failed |
| required_user_count | Total required users |
| missing_dvir_count | Users missing DVIR |
| missing_equipment_count | Users missing equipment |
| missing_both_count | Users missing both |
| webhooks_sent | Successful webhook calls |
| webhooks_skipped | Skipped (duplicates/dry-run) |

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
  "missingType": "missing_both",
  "missingItems": ["DVIR", "Equipment Inspection"],
  "appLink": "https://app.example.com/dashboard",
  "timestamp": "2026-01-08T15:00:00.000Z",
  "notificationId": "uuid"
}
```

## Error Handling

| Error | Action |
|-------|--------|
| Database connection failed | Mark run as failed, log error |
| User fetch failed | Mark run as failed, log error |
| Webhook failed | Mark notification as failed, continue with others |
| Duplicate notification | Skip silently (expected behavior) |

## Idempotency Rules
1. **Run Level**: Multiple runs for same `dateFor` will create multiple `compliance_runs` records (audit trail)
2. **Notification Level**: Only one notification per `(dateFor, user_id, notification_type)` due to unique constraint
3. **Webhook Level**: Only sent for newly inserted notifications

## Acceptance Criteria
- [ ] Only employees and foremen with email are checked
- [ ] Cutoff time is correctly converted to UTC
- [ ] Duplicate notifications are prevented
- [ ] All runs are logged in compliance_runs
- [ ] Dry-run mode skips webhooks but computes everything else
- [ ] Webhook payload matches expected schema

