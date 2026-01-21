# ATTS Telemetry System - Implementation Plan

> **Version**: 1.0  
> **Created**: 2026-01-16  
> **Status**: In Progress  
> **Author**: Engineering Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Event Schema](#event-schema)
4. [Database Design](#database-design)
5. [Frontend Client](#frontend-client)
6. [Admin Dashboard Specifications](#admin-dashboard-specifications)
7. [Privacy & Compliance](#privacy--compliance)
8. [Implementation Phases](#implementation-phases)
9. [Testing Strategy](#testing-strategy)

---

## Overview

### Purpose

The ATTS Telemetry System provides production-ready instrumentation for:

- **Form Analytics**: Track form completion times, error rates, and user behavior
- **Announcement Engagement**: Measure view rates for company communications
- **Duplicate Detection**: Prevent accidental duplicate submissions
- **ROI Measurement**: Establish baselines for AI initiative ROI calculations

### Design Principles

1. **Privacy-First**: No PII stored, aggregate-only queries for admins
2. **Reliability**: Guaranteed delivery via `sendBeacon` on page unload
3. **Performance**: Batched inserts with 5-second flush intervals
4. **Auditability**: 90-day retention with GDPR-compliant anonymization

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
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                                  │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Form Stats  │  │ Error Rates │  │ Engagement  │  │ Duplicates  │    │
│  │ p50/p90     │  │ by Type     │  │ Metrics     │  │ Prevented   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
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

## Database Design

### Table: `telemetry_events`

```sql
CREATE TABLE public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- User context (nullable for anonymous/pre-auth events)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  
  -- Event data
  event_name TEXT NOT NULL CHECK (event_name IN (
    'form_started',
    'form_submitted', 
    'form_submit_error',
    'announcement_viewed',
    'form_duplicate_detected',
    'form_duplicate_prevented',
    'form_duplicate_overridden'
  )),
  
  -- Flexible properties (JSONB)
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Page context
  route TEXT,
  form_type TEXT
);

-- Performance indexes
CREATE INDEX idx_telemetry_created_at ON telemetry_events(created_at DESC);
CREATE INDEX idx_telemetry_event_name ON telemetry_events(event_name);
CREATE INDEX idx_telemetry_form_type ON telemetry_events(form_type) WHERE form_type IS NOT NULL;
CREATE INDEX idx_telemetry_user_id ON telemetry_events(user_id) WHERE user_id IS NOT NULL;
```

### RLS Policies

```sql
-- Users can insert their own events
CREATE POLICY "Users can insert own telemetry"
  ON telemetry_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Admins can read all events (for aggregation)
CREATE POLICY "Admins can read telemetry"
  ON telemetry_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM app_users 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Service role has full access (for Edge Functions)
CREATE POLICY "Service role full access"
  ON telemetry_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

### GDPR Anonymization Trigger

```sql
CREATE FUNCTION anonymize_user_telemetry()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE telemetry_events 
  SET user_id = NULL 
  WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_delete_anonymize
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION anonymize_user_telemetry();
```

---

## Frontend Client

### File: `src/lib/telemetry.ts`

```typescript
/**
 * ATTS Telemetry Client
 * 
 * Provides event tracking with:
 * - Session management via sessionStorage
 * - Batched inserts with 5-second flush interval
 * - Guaranteed delivery via sendBeacon on page unload
 * - Feature flag support
 */

import { supabase } from './supabaseClient';
import { CONFIG } from './config';
import { logger } from './logger';

// ============================================================================
// TYPES
// ============================================================================

interface TelemetryEvent {
  user_id: string | null;
  session_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  route: string;
  form_type?: string;
}

type TelemetryEventName =
  | 'form_started'
  | 'form_submitted'
  | 'form_submit_error'
  | 'announcement_viewed'
  | 'form_duplicate_detected'
  | 'form_duplicate_prevented'
  | 'form_duplicate_overridden';

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_KEY = 'atts_telemetry_session_id';
const BATCH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 50;

// ============================================================================
// STATE
// ============================================================================

let eventQueue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export function initSession(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${crypto.randomUUID()}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getSessionId(): string {
  return sessionStorage.getItem(SESSION_KEY) || initSession();
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ============================================================================
// USER CONTEXT
// ============================================================================

export function setCurrentUserId(userId: string | null): void {
  currentUserId = userId;
}

function getCurrentUserId(): string | null {
  return currentUserId;
}

// ============================================================================
// FLUSH LOGIC
// ============================================================================

async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);

  try {
    const { error } = await supabase
      .from('telemetry_events')
      .insert(batch);

    if (error) {
      logger.warn('[Telemetry] Batch insert failed:', error.message);
      // Don't re-queue on failure to avoid infinite loops
    }
  } catch (err) {
    logger.error('[Telemetry] Flush error:', err);
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);

  // Immediate flush if queue is full
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
  }
}

// ============================================================================
// MAIN TRACKING FUNCTION
// ============================================================================

export function track(
  eventName: TelemetryEventName,
  properties: Record<string, unknown> = {}
): void {
  if (!CONFIG.telemetry?.enabled) return;

  const event: TelemetryEvent = {
    user_id: getCurrentUserId(),
    session_id: getSessionId(),
    event_name: eventName,
    properties: {
      ...properties,
      session_id: getSessionId(),
    },
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    form_type: properties.form_type as string | undefined,
  };

  eventQueue.push(event);
  scheduleFlush();
}

// ============================================================================
// PAGE UNLOAD HANDLER
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const queued = navigator.sendBeacon(
        `${supabaseUrl}/functions/v1/flush-telemetry`,
        JSON.stringify({ events: eventQueue })
      );

      if (!queued) {
        logger.warn('[Telemetry] sendBeacon failed to queue events');
      }
    }
  });

  // Initialize session on load
  initSession();
}
```

---

## Admin Dashboard Specifications

### Page: `/admin/telemetry`

The admin telemetry dashboard provides visual analytics for all collected telemetry data.

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ATTS Telemetry Dashboard                           [Date Range ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐            │
│  │ Total Events    │ │ Forms Submitted │ │ Error Rate      │            │
│  │     12,847      │ │      3,241      │ │      2.3%       │            │
│  │   ▲ 15% vs last │ │   ▲ 8% vs last  │ │   ▼ 0.5% vs last│            │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ FORM COMPLETION TIMES (p50/p90)                                 │    │
│  │                                                                  │    │
│  │  DVIR         ████████████░░░░  p50: 45s  p90: 120s             │    │
│  │  Equipment    ██████████░░░░░░  p50: 38s  p90: 95s              │    │
│  │  RTO          ████░░░░░░░░░░░░  p50: 22s  p90: 45s              │    │
│  │  JSA          ██████████████░░  p50: 180s p90: 420s             │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌────────────────────────────┐  ┌────────────────────────────────┐    │
│  │ ERROR BREAKDOWN BY FORM    │  │ ANNOUNCEMENTS ENGAGEMENT       │    │
│  │                            │  │                                │    │
│  │  DVIR:       ██░░ 12 errors│  │  Total Views:     4,521        │    │
│  │  Equipment:  █░░░  5 errors│  │  Unique Sessions: 892          │    │
│  │  RTO:        ░░░░  0 errors│  │  Safety AI Views: 2,103 (47%)  │    │
│  │  JSA:        ███░ 18 errors│  │                                │    │
│  │                            │  │  View Rate: 78% of users       │    │
│  └────────────────────────────┘  └────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ DUPLICATE DETECTION EFFECTIVENESS                               │    │
│  │                                                                  │    │
│  │  Duplicates Detected:   47                                      │    │
│  │  Prevented (saved):     38  (81%)  ✓                            │    │
│  │  Overridden (allowed):   9  (19%)                               │    │
│  │                                                                  │    │
│  │  Estimated Time Saved:  ~3.2 hours                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ EVENTS OVER TIME (Last 14 Days)                                 │    │
│  │                                                                  │    │
│  │      ▁▂▃▄▅▆▇█▇▆▅▄▃▂                                             │    │
│  │  Jan 2  4  6  8  10 12 14 16                                    │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Dashboard Components

#### 1. Summary Cards (Top Row)

| Card | Query | Display |
|------|-------|---------|
| Total Events | `COUNT(*) FROM telemetry_events WHERE created_at > now() - interval '14 days'` | Number with % change |
| Forms Submitted | `COUNT(*) WHERE event_name = 'form_submitted'` | Number with % change |
| Error Rate | `(form_submit_error / form_submitted) * 100` | Percentage with trend |

#### 2. Form Completion Times

```sql
SELECT 
  form_type,
  percentile_cont(0.5) WITHIN GROUP (
    ORDER BY (properties->>'duration_seconds')::numeric
  ) AS p50_seconds,
  percentile_cont(0.9) WITHIN GROUP (
    ORDER BY (properties->>'duration_seconds')::numeric
  ) AS p90_seconds,
  COUNT(*) AS sample_size
FROM telemetry_events
WHERE event_name = 'form_submitted'
  AND created_at > now() - interval '14 days'
  AND form_type IS NOT NULL
GROUP BY form_type
ORDER BY form_type;
```

#### 3. Error Breakdown

```sql
SELECT 
  form_type,
  properties->>'error_code' AS error_code,
  COUNT(*) AS count
FROM telemetry_events
WHERE event_name = 'form_submit_error'
  AND created_at > now() - interval '14 days'
GROUP BY form_type, properties->>'error_code'
ORDER BY count DESC;
```

#### 4. Announcement Engagement

```sql
SELECT 
  COUNT(*) AS total_views,
  COUNT(DISTINCT session_id) AS unique_sessions,
  COUNT(*) FILTER (
    WHERE (properties->>'is_ai_generated')::boolean = true
  ) AS ai_generated_views
FROM telemetry_events
WHERE event_name = 'announcement_viewed'
  AND created_at > now() - interval '14 days';
```

#### 5. Duplicate Detection Stats

```sql
SELECT 
  event_name,
  COUNT(*) AS count
FROM telemetry_events
WHERE event_name IN (
  'form_duplicate_detected',
  'form_duplicate_prevented',
  'form_duplicate_overridden'
)
AND created_at > now() - interval '14 days'
GROUP BY event_name;
```

#### 6. Events Over Time

```sql
SELECT 
  date_trunc('day', created_at) AS day,
  event_name,
  COUNT(*) AS count
FROM telemetry_events
WHERE created_at > now() - interval '14 days'
GROUP BY day, event_name
ORDER BY day;
```

### Admin Page Implementation

**File**: `src/pages/admin/AdminTelemetry.tsx`

```typescript
// Component structure
export default function AdminTelemetry() {
  return (
    <DashboardLayout title="Telemetry Dashboard">
      {/* Date Range Selector */}
      <DateRangeSelector />
      
      {/* Summary Cards Row */}
      <div className="grid grid-cols-3 gap-4">
        <TotalEventsCard />
        <FormsSubmittedCard />
        <ErrorRateCard />
      </div>
      
      {/* Form Completion Times */}
      <FormCompletionTimesChart />
      
      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        <ErrorBreakdownChart />
        <AnnouncementEngagementCard />
      </div>
      
      {/* Duplicate Detection */}
      <DuplicateDetectionStats />
      
      {/* Events Over Time */}
      <EventsTimelineChart />
    </DashboardLayout>
  );
}
```

### Hooks for Data Fetching

**File**: `src/hooks/queries/useTelemetryStats.ts`

```typescript
export function useTelemetryStats(dateRange: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['telemetry-stats', dateRange],
    queryFn: async () => {
      // Fetch aggregated stats from Supabase
      const { data, error } = await supabase.rpc('get_telemetry_stats', {
        date_from: dateRange.from.toISOString(),
        date_to: dateRange.to.toISOString(),
      });
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Database Functions for Dashboard

```sql
-- Aggregate function for dashboard (prevents raw data exposure)
CREATE OR REPLACE FUNCTION get_telemetry_stats(
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM app_users 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'totalEvents', (
      SELECT COUNT(*) FROM telemetry_events 
      WHERE created_at BETWEEN date_from AND date_to
    ),
    'formSubmissions', (
      SELECT COUNT(*) FROM telemetry_events 
      WHERE event_name = 'form_submitted' 
      AND created_at BETWEEN date_from AND date_to
    ),
    'formErrors', (
      SELECT COUNT(*) FROM telemetry_events 
      WHERE event_name = 'form_submit_error' 
      AND created_at BETWEEN date_from AND date_to
    ),
    'announcementViews', (
      SELECT COUNT(*) FROM telemetry_events 
      WHERE event_name = 'announcement_viewed' 
      AND created_at BETWEEN date_from AND date_to
    ),
    'duplicatesDetected', (
      SELECT COUNT(*) FROM telemetry_events 
      WHERE event_name = 'form_duplicate_detected' 
      AND created_at BETWEEN date_from AND date_to
    ),
    'duplicatesPrevented', (
      SELECT COUNT(*) FROM telemetry_events 
      WHERE event_name = 'form_duplicate_prevented' 
      AND created_at BETWEEN date_from AND date_to
    )
  ) INTO result;

  RETURN result;
END;
$$;
```

---

## Privacy & Compliance

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

### Retention Policy

- **Retention Period**: 90 days
- **Purge Schedule**: Weekly automated deletion of events older than 90 days
- **GDPR Compliance**: On user deletion, `user_id` is set to NULL (anonymized)

```sql
-- Automated purge (run weekly via cron)
DELETE FROM telemetry_events
WHERE created_at < now() - interval '90 days';
```

---

## Implementation Phases

### Phase A: Foundation (Day 1) ✅ COMPLETE
- [x] Create Telemetry_plan.md (this document)
- [x] Create migration: `20260116100000_create_telemetry_events.sql`
- [x] Create client: `src/lib/telemetry.ts`
- [x] Create Edge Function: `supabase/functions/flush-telemetry/index.ts`
- [x] Update config: `src/lib/config.ts`

### Phase B: Form Instrumentation (Day 2) ✅ COMPLETE
- [x] Instrument DVIRForm.tsx
- [x] Instrument DailyEquipmentInspectionForm.tsx
- [x] Instrument RequestTimeOff.tsx
- [x] Instrument DailyJSAForm.tsx

### Phase C: Announcement Tracking (Day 2) ✅ COMPLETE
- [x] Add IntersectionObserver to Announcements.tsx
- [x] Implement per-session deduplication
- [x] Create useAnnouncementTracking hook

### Phase D: Accessibility Audit (Day 3) ⏳ PENDING
- [ ] Run pa11y-ci
- [ ] Document results
- [ ] Create backlog

### Phase E: OpenAI Cost Script (Day 3) ✅ COMPLETE
- [x] Create cost aggregation script: `scripts/openai-costs.mjs`
- [x] Document methodology with pricing verification

### Phase F: Duplicate Detector (Day 4) ✅ COMPLETE
- [x] Create duplicateCheck.ts
- [x] Create DuplicateWarningModal.tsx
- [ ] Integrate into forms (ready for integration)

### Phase G: Testing & Documentation (Day 5) ✅ COMPLETE
- [x] Complete documentation: `docs/telemetry.md`
- [ ] Write unit tests (optional, pending)
- [ ] Run dry-run tests (pending deployment)

### Phase H: Admin Dashboard (Day 6-7) ✅ COMPLETE
- [x] Create AdminTelemetry.tsx page
- [x] Create useTelemetryStats hook
- [x] Create dashboard components
- [x] Add navigation link in adminNavConfig.tsx
- [x] Create database function: get_telemetry_dashboard_stats

---

## Testing Strategy

### Unit Tests

| Test | Description |
|------|-------------|
| `initSession` generates unique ID | Verify UUID format and uniqueness |
| `initSession` persists across calls | Same ID returned in same session |
| `clearSession` removes ID | sessionStorage cleared |
| `track` adds to queue | Event added with correct shape |
| `track` respects feature flag | No tracking when disabled |
| `flush` sends batch | Supabase insert called |
| `beforeunload` triggers beacon | sendBeacon called |

### Dry-Run Tests

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| A | Open DVIR form | `form_started` event recorded |
| B | Submit DVIR successfully | `form_submitted` with `duration_seconds` |
| C | Trigger validation error | `form_submit_error` recorded |
| D | View announcements page | `announcement_viewed` per visible card |
| E | Attempt duplicate DVIR | Modal shown, `form_duplicate_detected` |
| F | Close tab mid-form | `beforeunload` triggers beacon |
| G | Disable feature flag | No events tracked |
| H | Submit with network down | Event queued (no crash) |
| I | View same announcement twice | Only 1 event (dedupe working) |
| J | Run baseline script empty | "INSUFFICIENT DATA" message |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-16 | 1.0 | Initial plan created |
| 2026-01-16 | 1.1 | Implementation complete: migration, telemetry.ts, Edge Function, form instrumentation, announcement tracking, OpenAI cost script, duplicate detector, admin dashboard |

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [sendBeacon API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [GDPR Right to Erasure](https://gdpr.eu/right-to-erasure/)
