# AI Safety + Compliance Agent

A modular service for managing safety communications and compliance enforcement in the ATTS Employee Portal.

## Overview

This module provides:
1. **Compliance Checking**: Deterministic 9:00 AM checks for DVIR and equipment inspection submissions
2. **Webhook Notifications**: Send compliance reminders via Make.com
3. **Safety Announcements**: LLM-assisted announcement generation from JSA data using OpenAI

## Architecture

```
src/services/safety-agent/
├── index.ts                    # Main exports
├── README.md                   # This file
├── directives/                 # SOPs and business rules
├── execution/                  # Deterministic scripts
├── prompts/                    # LLM prompt templates (versioned)
├── types/                      # TypeScript interfaces
├── lib/                        # Utilities
└── tests/                      # Unit tests
```

## Quick Start

### 1. Environment Variables

Add these to your `.env` file:

```env
# Required for compliance checks
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for safety announcements (LLM generation)
OPENAI_API_KEY=sk-your-api-key-here

# Make.com webhook for notifications (use either name)
VITE_MAKE_DEN_WEBHOOK_URL=https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc
# Or for Edge Functions:
# MAKE_WEBHOOK_URL=https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc

# App configuration
APP_BASE_URL=https://att-semployee-portal-main-2.vercel.app

# Optional flags
DRY_RUN=false
EMAIL_NOTIFICATIONS_ENABLED=true
TIMEZONE=America/Chicago
COMPLIANCE_CUTOFF=09:00

# Optional: Announcement generation settings
ANNOUNCEMENTS_MODE=draft  # or auto_publish
```

### Getting Your OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/account/api-keys)
2. Sign in or create an account
3. Navigate to "API Keys" in the left sidebar
4. Click "Create new secret key"
5. Copy the key and add it to your `.env` file as `OPENAI_API_KEY`

**Important**: Never commit your API key to version control!

### 2. Run Database Migrations

Apply the migrations in order:

```bash
# From project root
supabase db push
```

Or apply manually:
1. `20260108000000_add_compliance_runs_and_notifications.sql`
2. `20260108000001_add_dvir_report_date.sql`

### 3. Deploy Edge Function

```bash
supabase functions deploy check-compliance-9am
```

### 4. Schedule the Function

In Supabase Dashboard → Database → Extensions, enable `pg_cron`.

Then create a scheduled job:

```sql
-- Run at 9:00 AM Chicago time (14:00 or 15:00 UTC depending on DST)
-- Using 15:00 UTC for standard time (CST)
SELECT cron.schedule(
  'compliance-check-9am',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/check-compliance-9am',
    headers := '{"Authorization": "Bearer your-anon-key"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Note: Adjust the hour for DST (14:00 UTC during CDT, 15:00 UTC during CST).

## Manual Testing

### Test via cURL

```bash
# Dry run for today
curl -X POST \
  'https://your-project.supabase.co/functions/v1/check-compliance-9am?dry_run=true' \
  -H 'Authorization: Bearer your-anon-key'

# Specific date
curl -X POST \
  'https://your-project.supabase.co/functions/v1/check-compliance-9am' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"dateFor": "2026-01-08", "dryRun": true}'
```

### Test Locally

```typescript
import { checkCompliance9am } from './src/services/safety-agent';

const result = await checkCompliance9am({
  dateFor: '2026-01-08',
  dryRun: true,
});

console.log(result);
```

## API Reference

### checkCompliance9am(options)

Run the compliance check for a given date.

```typescript
interface ComplianceCheckOptions {
  dateFor?: string;           // YYYY-MM-DD, default: today in Chicago
  cutoffLocal?: string;       // HH:MM, default: '09:00'
  timezone?: string;          // default: 'America/Chicago'
  dryRun?: boolean;           // default: from env
  notificationsEnabled?: boolean; // default: from env
}

interface ComplianceRunResult {
  runId: string;
  dateFor: string;
  requiredUserCount: number;
  missingDvirCount: number;
  missingEquipmentCount: number;
  missingBothCount: number;
  webhooksSent: number;
  webhooksSkipped: number;
  status: 'success' | 'failed';
  error?: string;
  dryRun: boolean;
}
```

### sendComplianceEmail(params)

Send a single compliance notification via Make.com webhook.

```typescript
interface SendComplianceEmailParams {
  notificationId: string;
  dateFor: string;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
  };
  missingType: 'missing_dvir' | 'missing_equipment' | 'missing_both';
  runId?: string;
}
```

## Database Tables

### compliance_runs

Audit log of each compliance check execution.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| run_type | text | 'dvir_equipment_9am' |
| date_for | date | Date checked |
| status | text | running/success/failed |
| missing_*_count | int | Counts by category |
| webhooks_sent | int | Successful notifications |

### compliance_notifications

Individual notification records with dedupe constraint.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| date_for | date | Date checked |
| user_id | uuid | User reference |
| notification_type | text | missing_dvir/equipment/both |
| status | text | pending/sent/failed/skipped |
| **UNIQUE** | | (date_for, user_id, notification_type) |

## Make.com Webhook Payload

```json
{
  "type": "compliance_reminder",
  "dateFor": "2026-01-08",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "fullName": "John Smith",
    "role": "employee"
  },
  "missingType": "missing_both",
  "missingItems": ["DVIR", "Equipment Inspection"],
  "appLink": "https://app.example.com/dashboard",
  "timestamp": "2026-01-08T15:00:00.000Z",
  "notificationId": "notification-uuid"
}
```

## Troubleshooting

### "Missing SUPABASE_SERVICE_ROLE_KEY"

The service role key is required for server-to-server operations. Set it in your environment or Supabase Edge Function secrets.

### Duplicate notifications not being skipped

Check that the unique constraint exists:

```sql
SELECT * FROM pg_constraint 
WHERE conname = 'unique_notification_per_user_day_type';
```

### Wrong timezone for cutoff

Verify the `TIMEZONE` env var is set to `America/Chicago`. Check logs for the computed cutoff UTC timestamp.

## Safety Announcements API

### generateDailySafetyAnnouncement(options)

Generate a safety announcement from recent JSA submissions using OpenAI.

```typescript
import { generateDailySafetyAnnouncement } from './src/services/safety-agent';

const result = await generateDailySafetyAnnouncement({
  windowHours: 24,        // Hours to look back for JSAs
  minSubmissions: 3,      // Min JSAs before showing "low data" message
  promptVersion: 'v1',    // Prompt version for auditability
  mode: 'draft',          // 'draft' or 'auto_publish'
  model: 'gpt-4o-mini',   // OpenAI model (cost-effective default)
  temperature: 0.3,       // Lower = more deterministic
});

if (result.success) {
  console.log(result.announcement.title);
  console.log(result.announcement.body);  // Max 283 chars
  console.log(result.announcement.summary); // Max 240 chars
}
```

### Options

```typescript
interface GenerateAnnouncementOptions {
  windowHours?: number;     // Default: 24
  minSubmissions?: number;  // Default: 3
  promptVersion?: string;   // Default: 'v1'
  mode?: 'draft' | 'auto_publish';  // Default: 'draft'
  model?: string;           // Default: 'gpt-4o-mini'
  temperature?: number;     // Default: 0.3
}
```

### Result

```typescript
interface GenerateAnnouncementResult {
  success: boolean;
  announcement?: {
    title: string;
    body: string;      // Max 283 chars (target 238)
    summary: string;   // Max 240 chars
    sections: { overview, topHazards, ppeReminders, expectations };
    metadata: { windowStart, windowEnd, jsaCount, promptVersion, model, ... };
  };
  announcementId?: string;  // If saved to DB
  error?: string;
  lowData?: boolean;        // True if below minSubmissions
  truncated?: boolean;      // True if body/summary was truncated
}
```

### OpenAI Utilities

```typescript
import { 
  isOpenAIConfigured,  // Check if API key is set
  chatCompletion,      // Generic chat completion
  jsonCompletion,      // Chat completion with JSON response
  getDefaultModel,     // Get default model name
} from './src/services/safety-agent';

// Check configuration
if (!isOpenAIConfigured()) {
  console.error('Set OPENAI_API_KEY');
}

// Generic chat completion
const result = await chatCompletion({
  systemPrompt: 'You are a helpful assistant.',
  userMessage: 'Hello!',
  model: 'gpt-4o-mini',
  temperature: 0.7,
});

// JSON completion (parses response automatically)
const jsonResult = await jsonCompletion<{ answer: string }>({
  systemPrompt: 'Respond in JSON with an "answer" field.',
  userMessage: 'What is 2+2?',
});
if (jsonResult.success) {
  console.log(jsonResult.data?.answer); // "4"
}
```

## Future Work

- [x] LLM-assisted safety announcements from JSA data
- [ ] Weekly trends reports
- [ ] SMS notifications via Make.com
- [ ] Dashboard for viewing compliance history
- [ ] Human-in-the-loop approval workflow for announcements

