# Directive: Email Notifications via Make.com

## Purpose
Define how compliance reminder notifications are sent to users via the Make.com webhook integration.

## Webhook Configuration

### Endpoint
```
https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc
```

### Method
`POST` with `Content-Type: application/json`

## Payload Schema

```typescript
interface ComplianceWebhookPayload {
  // Identifies this as a compliance reminder
  type: 'compliance_reminder';
  
  // The date being checked (YYYY-MM-DD)
  dateFor: string;
  
  // User information
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
  
  // What's missing
  missingType: 'missing_dvir' | 'missing_equipment' | 'missing_both';
  
  // Human-readable list of missing items
  missingItems: string[];
  
  // Link to the app for submission
  appLink: string;
  
  // ISO timestamp of when this notification was generated
  timestamp: string;
  
  // Unique notification ID for tracking
  notificationId: string;
}
```

## Example Payloads

### Missing DVIR Only
```json
{
  "type": "compliance_reminder",
  "dateFor": "2026-01-08",
  "user": {
    "id": "abc-123-def",
    "email": "john.smith@example.com",
    "fullName": "John Smith",
    "role": "employee"
  },
  "missingType": "missing_dvir",
  "missingItems": ["DVIR (Daily Vehicle Inspection Report)"],
  "appLink": "https://atts-portal.vercel.app/dashboard",
  "timestamp": "2026-01-08T15:00:00.000Z",
  "notificationId": "notif-xyz-789"
}
```

### Missing Both
```json
{
  "type": "compliance_reminder",
  "dateFor": "2026-01-08",
  "user": {
    "id": "abc-123-def",
    "email": "jane.doe@example.com",
    "fullName": "Jane Doe",
    "role": "foreman"
  },
  "missingType": "missing_both",
  "missingItems": [
    "DVIR (Daily Vehicle Inspection Report)",
    "Daily Equipment Inspection"
  ],
  "appLink": "https://atts-portal.vercel.app/dashboard",
  "timestamp": "2026-01-08T15:00:00.000Z",
  "notificationId": "notif-xyz-790"
}
```

## Make.com Scenario Design

The Make.com scenario should:

1. **Receive Webhook** - Parse the JSON payload
2. **Format Email** - Create user-friendly email content
3. **Send Email** - Via SendGrid, Gmail, or other provider
4. **Log Result** - Optional: write to Google Sheet for audit

### Suggested Email Template

**Subject**: [ATTS] Daily Form Reminder - {dateFor}

**Body**:
```
Hi {fullName},

This is a friendly reminder that you haven't submitted the following required forms for {dateFor}:

{missingItems as bullet list}

Please submit these forms as soon as possible by visiting:
{appLink}

If you've already submitted these forms, please disregard this message.

Thank you,
ATTS Safety Team
```

## Error Handling

### Webhook Failures
| HTTP Status | Action |
|-------------|--------|
| 2xx | Mark notification as `sent` |
| 4xx | Mark notification as `failed`, log error |
| 5xx | Mark notification as `failed`, consider retry |
| Timeout | Mark notification as `failed` |

### Retry Policy
Currently: No automatic retries. Failed notifications are logged for manual review.

Future: Consider implementing retry queue in Make.com or via Supabase scheduled function.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MAKE_WEBHOOK_URL` | The Make.com webhook URL | `https://hook.us2.make.com/...` |
| `APP_BASE_URL` | Base URL for app links | `https://atts-portal.vercel.app` |
| `DRY_RUN` | Skip actual webhook calls | `true` or `false` |
| `EMAIL_NOTIFICATIONS_ENABLED` | Master toggle | `true` or `false` |

## Dry Run Behavior

When `DRY_RUN=true`:
- Payload is constructed normally
- Payload is logged (not sent)
- Notification is marked as `skipped` with reason `dry_run`
- Useful for testing without sending actual emails

## Idempotency

The system prevents duplicate emails via:
1. Unique constraint on `(date_for, user_id, notification_type)`
2. Only new notification inserts trigger webhooks
3. Existing notifications are skipped silently

