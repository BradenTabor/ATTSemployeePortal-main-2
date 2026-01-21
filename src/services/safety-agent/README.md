# AI Safety + Compliance Agent

A modular service for managing safety communications and compliance enforcement in the ATTS Employee Portal.

## Overview

This module provides:
1. **Daily Safety Announcement** (7:00 AM CST, Mon-Fri): LLM-assisted announcement generation analyzing 48 hours of JSA, DVIR, and Equipment data with push notifications
2. **Admin Compliance Summary** (9:00 AM CST, Mon-Fri): Daily consolidated email to ATTS Administration with all non-compliant employees
3. **Compliance Checking**: Deterministic checks for DVIR, Equipment Inspection, and Daily JSA submissions
4. **Dual Notification System**: Direct Gmail SMTP (raw socket) + Make.com webhook (audit/Google Sheets logging)

### Email Architecture

The Edge Function sends emails using **raw SMTP** directly to Gmail's servers (not via third-party libraries), ensuring:
- ✅ Proper MIME multipart formatting (text/plain + text/html)
- ✅ Reliable TLS connection to `smtp.gmail.com:465`
- ✅ No encoding issues or raw MIME content in emails
- ✅ Works natively in Deno/Supabase Edge Functions

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

# ======================
# GMAIL CONFIGURATION (Admin Compliance Summary)
# ======================
GMAIL_USER=allterraintreeservice.po@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # 16-char Google App Password (NOT your login password)
ADMIN_EMAIL_RECIPIENTS=bradenleetabor@gmail.com,shane@alltts.com,dusty@alltts.com,mike@alltts.com,steve@alltts.com,brandon@alltts.com

# ======================
# MAKE.COM WEBHOOK (for Google Sheets logging)
# ======================
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

### Getting Your Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to **App Passwords** (search in settings)
4. Select "Mail" and "Other (Custom name)" → enter "ATTS Safety Agent"
5. Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
6. Add it to your `.env` as `GMAIL_APP_PASSWORD`

**Important:** This is NOT your regular Gmail password!

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

### 3. Deploy Edge Functions

```bash
# NEW: Admin Compliance Summary (recommended)
supabase functions deploy admin-compliance-cron

# Legacy: Individual user notifications (deprecated)
supabase functions deploy check-compliance-9am
```

### 4. Add Edge Function Secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add:

| Secret | Value |
|--------|-------|
| `GMAIL_USER` | `allterraintreeservice.po@gmail.com` |
| `GMAIL_APP_PASSWORD` | Your 16-character App Password |
| `MAKE_WEBHOOK_URL` | Your Make.com webhook URL |

### 5. Schedule the Function

In Supabase Dashboard → Database → Extensions, enable `pg_cron` and `pg_net`.

Then create a scheduled job:

```sql
-- Admin Compliance Summary: 9:00 AM Chicago time (Mon-Fri only)
-- 15:00 UTC = 9:00 AM CST, 14:00 UTC = 9:00 AM CDT
SELECT cron.schedule(
  'admin-compliance-9am',
  '0 15 * * 1-5',  -- Mon-Fri at 15:00 UTC (9 AM CST)
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/admin-compliance-cron',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Important:** Replace `your-project` with your actual Supabase project ID.

Note: Adjust the hour for DST (14:00 UTC during CDT, 15:00 UTC during CST).

## Manual Testing

### Test Admin Compliance Summary via cURL

```bash
# Test the admin compliance summary (production)
curl -X POST \
  'https://your-project.supabase.co/functions/v1/admin-compliance-cron' \
  -H 'Content-Type: application/json'
```

### Test Locally

```typescript
import { runAdminComplianceSummary } from './src/services/safety-agent';

// Full workflow: check compliance + generate email + send via Gmail + webhook
const result = await runAdminComplianceSummary({
  dryRun: false,  // Set true to skip sending emails/webhooks
});

console.log(result.status);                    // 'success', 'failed', or 'skipped'
console.log(result.summary.totalNonCompliant); // Number of non-compliant users
console.log(result.gmailSent);                 // Gmail send result
console.log(result.webhookSent);               // Webhook send result
```

### Test Legacy Individual Compliance (deprecated)

```typescript
import { checkCompliance9am } from './src/services/safety-agent';

const result = await checkCompliance9am({
  dateFor: '2026-01-08',
  dryRun: true,
});

console.log(result);
```

## API Reference

### runAdminComplianceSummary(options) — **PRIMARY**

Run the full admin compliance workflow: check forms, generate email, send via Gmail + webhook.

```typescript
interface AdminComplianceSummaryOptions {
  dateFor?: string;           // YYYY-MM-DD, default: today in Chicago
  cutoffLocal?: string;       // HH:MM, default: '09:00'
  timezone?: string;          // default: 'America/Chicago'
  dryRun?: boolean;           // default: from env
  supabase?: SupabaseClient;  // default: creates admin client
}

interface AdminComplianceSummaryResult {
  status: 'success' | 'failed' | 'skipped';
  dateFor: string;
  isWeekend?: boolean;
  summary: {
    totalRequired: number;
    totalCompliant: number;
    totalNonCompliant: number;
  };
  nonCompliantUsers: NonCompliantUser[];
  emailHtml?: string;
  emailText?: string;
  gmailSent?: { success: boolean; messageId?: string; error?: string };
  webhookSent?: { success: boolean; webhookResponse?: any; error?: string };
  durationMs: number;
  error?: string;
}
```

### checkAdminCompliance9am(options)

Fetch required users and compute non-compliant list (deterministic, no sending).

```typescript
interface AdminComplianceCheckOptions {
  dateFor?: string;           // YYYY-MM-DD
  cutoffLocal?: string;       // HH:MM, default: '09:00'
  timezone?: string;          // default: 'America/Chicago'
  supabase?: SupabaseClient;
}

// Returns AdminComplianceSummary with nonCompliantUsers list
```

### generateAdminSummaryEmail(summary, dateFor)

Generate HTML and plain text email from compliance summary (deterministic).

```typescript
interface GeneratedEmail {
  subject: string;
  html: string;
  text: string;
}
```

### sendAdminSummaryEmail(params)

Send the compliance email via Gmail SMTP and Make.com webhook.

```typescript
interface SendAdminSummaryEmailParams {
  summary: AdminComplianceSummary;
  dateFor: string;
  emailHtml: string;
  emailText: string;
  runId?: string;
}

interface AdminEmailSendResult {
  gmail: { success: boolean; messageId?: string; error?: string };
  webhook: { success: boolean; webhookResponse?: any; error?: string };
}
```

---

### checkCompliance9am(options) — **DEPRECATED**

Run the legacy compliance check for a given date (individual user notifications).

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

## Make.com Webhook Payloads

### Admin Compliance Summary (NEW)

```json
{
  "type": "admin_compliance_summary",
  "dateFor": "2026-01-08",
  "subject": "Daily Compliance Summary - January 8, 2026",
  "emailBody": "<html>...</html>",
  "recipients": ["bradenleetabor@gmail.com", "shane@alltts.com", ...],
  "summary": {
    "totalRequired": 25,
    "totalCompliant": 20,
    "totalNonCompliant": 5
  },
  "nonCompliantUsers": [
    {
      "userId": "uuid",
      "email": "user@example.com",
      "fullName": "John Smith",
      "role": "employee",
      "missingForms": ["DVIR", "Daily JSA"],
      "missingType": "missing_dvir_jsa"
    }
  ],
  "timestamp": "2026-01-08T15:00:00.000Z"
}
```

### Individual Compliance Reminder (DEPRECATED)

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
  "missingType": "missing_all",
  "missingItems": ["DVIR", "Equipment Inspection", "Daily JSA"],
  "appLink": "https://app.example.com/dashboard",
  "timestamp": "2026-01-08T15:00:00.000Z",
  "notificationId": "notification-uuid"
}
```

### Notification Types (Extended for JSA)

| Type | Description |
|------|-------------|
| `missing_all` | Missing DVIR, Equipment, AND JSA |
| `missing_dvir_equipment` | Missing DVIR and Equipment |
| `missing_dvir_jsa` | Missing DVIR and JSA |
| `missing_equipment_jsa` | Missing Equipment and JSA |
| `missing_dvir` | Missing DVIR only |
| `missing_equipment` | Missing Equipment only |
| `missing_jsa` | Missing JSA only |
```

## Troubleshooting

### "Missing SUPABASE_SERVICE_ROLE_KEY"

The service role key is required for server-to-server operations. Set it in your environment or Supabase Edge Function secrets.

### Email shows raw MIME content (encoding issues)

If emails display raw MIME boundaries like `--boundary100` or encoded characters like `=3d`:

**Cause:** Third-party SMTP libraries (like `denomailer`) can have MIME encoding bugs in Deno environments.

**Solution:** The Edge Function uses **raw SMTP** directly via Deno's native TLS sockets, which properly formats multipart emails. Make sure you're using the latest version of `admin-compliance-cron`.

The fixed implementation:
- Builds raw MIME email with proper `multipart/alternative` structure
- Connects directly to `smtp.gmail.com:465` using TLS
- Handles `AUTH LOGIN` authentication properly
- Sends both `text/plain` and `text/html` parts

### Gmail authentication fails

Ensure your `GMAIL_APP_PASSWORD`:
1. Is a 16-character App Password (not your regular password)
2. Has no spaces when stored in Supabase secrets
3. Was generated after enabling 2-Step Verification

### Duplicate notifications not being skipped

Check that the unique constraint exists:

```sql
SELECT * FROM pg_constraint 
WHERE conname = 'unique_notification_per_user_day_type';
```

### Wrong timezone for cutoff

Verify the `TIMEZONE` env var is set to `America/Chicago`. Check logs for the computed cutoff UTC timestamp.

## Safety Announcements API

### Scheduled Execution (7 AM CST)

The safety announcement generates automatically at **7:00 AM Central Time, Monday-Friday** via pg_cron:

```sql
-- Cron schedule: 0 13 * * 1-5 (13:00 UTC = 7 AM CST)
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 13 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/generate-safety-announcement',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"windowHours": 48}'::jsonb
  );
  $$
);
```

### Data Sources

The announcement aggregates data from three tables:
- `daily_jsa` - Job Safety Analysis forms (hazards, PPE, near-misses)
- `dvir_reports` - Vehicle inspection reports (deficiencies, issues)
- `daily_equipment_inspections` - Equipment checks (failures, issues)

### generateDailySafetyAnnouncement(options)

Generate a safety announcement from recent safety data using OpenAI.

```typescript
import { generateDailySafetyAnnouncement } from './src/services/safety-agent';

const result = await generateDailySafetyAnnouncement({
  windowHours: 48,        // Hours to look back (default: 48)
  minSubmissions: 3,      // Min total submissions before "low data" message
  promptVersion: 'v2',    // Prompt version for auditability
  mode: 'auto_publish',   // 'draft' or 'auto_publish'
  model: 'gpt-4o-mini',   // OpenAI model (cost-effective default)
  temperature: 0.3,       // Lower = more deterministic
});

if (result.success) {
  console.log(result.announcement.title);
  console.log(result.announcement.body);  // Max 283 chars
  console.log(result.announcement.summary); // Max 240 chars
  console.log(result.stats.jsaCount);      // JSA forms analyzed
  console.log(result.stats.dvirCount);     // DVIR reports analyzed
  console.log(result.stats.equipmentCount); // Equipment inspections analyzed
}
```

### Options

```typescript
interface GenerateAnnouncementOptions {
  windowHours?: number;     // Default: 48
  minSubmissions?: number;  // Default: 3
  promptVersion?: string;   // Default: 'v2'
  mode?: 'draft' | 'auto_publish';  // Default: 'auto_publish'
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
- [x] Multi-source data aggregation (JSA + DVIR + Equipment)
- [x] 7 AM CST scheduled safety announcements (Mon-Fri)
- [x] 48-hour data window for announcements
- [x] Push notifications for safety announcements
- [x] Admin Compliance Summary email (consolidated report to administration)
- [x] Daily JSA compliance checking (in addition to DVIR + Equipment)
- [x] Direct Gmail SMTP integration
- [x] Dual notification system (Gmail + Make.com webhook)
- [x] Weekday-only scheduling (skip weekends)
- [ ] Weekly trends reports
- [ ] SMS notifications via Make.com
- [ ] Dashboard for viewing compliance history
- [ ] Human-in-the-loop approval workflow for announcements
- [ ] DST-aware automatic UTC hour adjustment

