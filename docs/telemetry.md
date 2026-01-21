# ATTS Telemetry System Documentation

> **Version**: 1.0  
> **Created**: 2026-01-16  
> **Status**: Production Ready

---

## Overview

The ATTS Telemetry System provides production-ready instrumentation for:

- **Form Analytics**: Track form completion times, error rates, and user behavior
- **Announcement Engagement**: Measure view rates for company communications
- **Duplicate Detection**: Prevent accidental duplicate submissions
- **ROI Measurement**: Establish baselines for AI initiative ROI calculations

---

## Quick Start

### Enable Telemetry

Telemetry is enabled by default. To disable:

```bash
# .env
VITE_TELEMETRY_ENABLED=false
```

### Track a Form

```typescript
import {
  trackFormStarted,
  trackFormSubmitted,
  trackFormSubmitError,
  createFormTimer,
} from '../lib/telemetry';

// On form mount
useEffect(() => {
  trackFormStarted({ form_type: 'dvir' });
  formTimer.current.reset();
}, []);

// On successful submit
trackFormSubmitted({
  form_type: 'dvir',
  duration_seconds: formTimer.current.getDuration(),
});

// On error
trackFormSubmitError({
  form_type: 'dvir',
  error_code: 'VALIDATION_FAILED',
  field_name: 'truckNumber',
});
```

### Track Announcement Views

```typescript
import { useAnnouncementTracking } from '../hooks/useAnnouncementTracking';

function AnnouncementCard({ announcement }) {
  const trackingRef = useAnnouncementTracking(
    announcement.id,
    announcement.author === 'Safety AI',
    { source: 'announcements_page' }
  );

  return <div ref={trackingRef}>...</div>;
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND LAYER                                 │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  DVIRForm   │  │ Equipment   │  │    RTO      │  │ JSAWizard   │    │
│  │             │  │ Inspection  │  │   Form      │  │             │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
│         └────────────────┴────────────────┴────────────────┘            │
│                                   │                                      │
│                                   ▼                                      │
│                        ┌──────────────────┐                             │
│                        │   telemetry.ts   │                             │
│                        │                  │                             │
│                        │ • Session mgmt   │                             │
│                        │ • Event queue    │                             │
│                        │ • Batch flush    │                             │
│                        │ • beforeunload   │                             │
│                        └────────┬─────────┘                             │
│                                 │                                        │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │ Supabase Insert     │ sendBeacon (unload) │
            ▼                     ▼                     │
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE BACKEND                               │
│                                                                          │
│  ┌────────────────────────┐      ┌────────────────────────┐            │
│  │   telemetry_events     │◄─────│   flush-telemetry      │            │
│  │   (PostgreSQL table)   │      │   (Edge Function)      │            │
│  │                        │      │                        │            │
│  │ • RLS: users insert    │      │ • Receives beacon      │            │
│  │ • RLS: admins read     │      │ • service_role insert  │            │
│  │ • 90-day retention     │      │ • No auth required     │            │
│  │ • GDPR anonymization   │      └────────────────────────┘            │
│  └────────────────────────┘                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Event Schema

### Core Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `form_started` | User opens a form | `form_type`, `session_id` |
| `form_submitted` | Form successfully submitted | `form_type`, `duration_seconds`, `session_id` |
| `form_submit_error` | Submission failed | `form_type`, `error_code`, `field_name`, `session_id` |
| `announcement_viewed` | Announcement card viewed | `announcement_id`, `is_ai_generated`, `source`, `session_id` |
| `form_duplicate_detected` | Duplicate submission detected | `form_type`, `entity_id`, `date_for` |
| `form_duplicate_prevented` | User chose not to submit duplicate | `form_type`, `entity_id` |
| `form_duplicate_overridden` | User submitted duplicate anyway | `form_type`, `entity_id` |

### Form Types

| Form Type | Component | Description |
|-----------|-----------|-------------|
| `dvir` | DVIRForm.tsx | Daily Vehicle Inspection Report |
| `equipment` | DailyEquipmentInspectionForm.tsx | Equipment inspections |
| `rto` | RequestTimeOff.tsx | Time off requests |
| `jsa` | JsaWizard.tsx | Job Safety Analysis |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_FAILED` | Client-side validation error |
| `NETWORK_ERROR` | Request failed due to connectivity |
| `SERVER_ERROR` | Supabase returned an error |
| `AUTH_ERROR` | User not authenticated |
| `RLS_VIOLATION` | Row-level security blocked the operation |

---

## Privacy Guidelines

### Data Collection Rules

**ALLOWED in `properties`**:
- `form_type` (dvir, equipment, rto, jsa)
- `duration_seconds` (numeric)
- `error_code` (enum)
- `field_name` (field identifier, not value)
- `announcement_id` (UUID)
- `is_ai_generated` (boolean)
- `entity_id` (truck/equipment number)
- `date_for` (date string)

**FORBIDDEN in `properties`**:
- User names
- Email addresses
- Phone numbers
- Signatures (image data)
- Free-text notes or comments
- Location data
- IP addresses

### Admin Query Guidelines

**ALLOWED Queries**:
```sql
-- Aggregated metrics
SELECT form_type, COUNT(*) FROM telemetry_events GROUP BY form_type;

-- Percentiles
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY duration);

-- Trends over time
SELECT date_trunc('day', created_at), COUNT(*) GROUP BY 1;
```

**FORBIDDEN Queries**:
```sql
-- Individual user tracking
SELECT user_id, COUNT(*) GROUP BY user_id;  -- ❌ FORBIDDEN

-- Joining with user data
SELECT u.full_name, COUNT(*) 
FROM telemetry_events t
JOIN app_users u ON t.user_id = u.user_id
GROUP BY u.full_name;  -- ❌ FORBIDDEN

-- Raw event export
SELECT * FROM telemetry_events;  -- ❌ FORBIDDEN
```

---

## Data Retention Policy

### Retention Period

- **Active Data**: 90 days
- **Purge Schedule**: Weekly automated deletion of events older than 90 days

### GDPR Compliance

When a user account is deleted:
1. The `anonymize_user_telemetry()` trigger fires
2. All telemetry events for that user have `user_id` set to `NULL`
3. Aggregate data is preserved, but individual tracking is impossible

### Purge Query

```sql
-- Run weekly via cron
DELETE FROM telemetry_events
WHERE created_at < now() - interval '90 days';
```

---

## Admin Dashboard

Access the telemetry dashboard at `/admin/telemetry`.

### Features

- **Summary Cards**: Total events, forms submitted, error rate, announcement views
- **Form Completion Times**: p50/p90 duration by form type
- **Error Breakdown**: Errors by form type with rates
- **Announcement Engagement**: Total views, unique sessions, AI-generated views
- **Duplicate Detection Stats**: Detected, prevented, overridden counts
- **Activity Timeline**: Events over time chart

### Date Range Options

- 7 days
- 14 days (default)
- 30 days
- 90 days

---

## API Reference

### telemetry.ts

```typescript
// Session Management
initSession(): string
getSessionId(): string
clearSession(): void

// User Context
setCurrentUserId(userId: string | null): void

// Tracking
track(eventName: TelemetryEventName, properties?: Record<string, unknown>): void
trackFormStarted(props: FormStartedProps): void
trackFormSubmitted(props: FormSubmittedProps): void
trackFormSubmitError(props: FormSubmitErrorProps): void
trackAnnouncementViewed(props: AnnouncementViewedProps): void
trackDuplicateDetected(props: DuplicateEventProps): void
trackDuplicatePrevented(props: DuplicateEventProps): void
trackDuplicateOverridden(props: DuplicateEventProps): void

// Utilities
createFormTimer(): { getDuration: () => number; reset: () => void }
```

### useAnnouncementTracking Hook

```typescript
function useAnnouncementTracking(
  announcementId: string,
  isAiGenerated: boolean,
  options: {
    source: 'dashboard' | 'announcements_page' | 'notification';
    threshold?: number;  // Default: 0.5
    minVisibleTime?: number;  // Default: 1000ms
  }
): React.RefCallback<HTMLElement>
```

### duplicateCheck.ts

```typescript
async function checkForDuplicate(params: {
  formType: 'dvir' | 'equipment';
  userId: string;
  dateFor: string;
  entityId: string;
}): Promise<{
  isDuplicate: boolean;
  existingRecord?: { id: string; created_at: string; submitted_by?: string };
  error?: string;
}>
```

---

## Database Schema

### Table: telemetry_events

```sql
CREATE TABLE public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  route TEXT,
  form_type TEXT
);
```

### RLS Policies

1. **telemetry_insert_own**: Users can insert their own events
2. **telemetry_admin_read**: Admins can read all events
3. **telemetry_service_role_all**: Service role has full access

### Database Function

```sql
get_telemetry_dashboard_stats(
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ
) RETURNS JSON
```

---

## Troubleshooting

### Events Not Recording

1. Check `VITE_TELEMETRY_ENABLED` is not set to `false`
2. Verify user is authenticated (for form events)
3. Check browser console for telemetry debug logs
4. Verify the `telemetry_events` table exists

### Dashboard Shows No Data

1. Wait for events to be flushed (5-second batch interval)
2. Check date range selection
3. Verify admin role in `app_users` table
4. Check for RLS policy errors in Supabase logs

### sendBeacon Failing

1. Check Edge Function `flush-telemetry` is deployed
2. Verify CORS headers are correct
3. Check payload size (max 64KB for sendBeacon)

---

## Files Reference

| File | Description |
|------|-------------|
| `src/lib/telemetry.ts` | Main telemetry client |
| `src/lib/config.ts` | Telemetry configuration |
| `src/lib/duplicateCheck.ts` | Duplicate detection utility |
| `src/hooks/useAnnouncementTracking.ts` | Announcement view tracking hook |
| `src/hooks/queries/useTelemetryStats.ts` | Dashboard data hook |
| `src/components/forms/DuplicateWarningModal.tsx` | Duplicate warning UI |
| `src/pages/admin/AdminTelemetry.tsx` | Admin dashboard page |
| `supabase/functions/flush-telemetry/index.ts` | Edge Function for sendBeacon |
| `supabase/migrations/20260116100000_create_telemetry_events.sql` | Database migration |
| `scripts/openai-costs.mjs` | OpenAI cost aggregation script |
| `docs/Telemetry_plan.md` | Full implementation plan |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-16 | 1.0 | Initial implementation |
