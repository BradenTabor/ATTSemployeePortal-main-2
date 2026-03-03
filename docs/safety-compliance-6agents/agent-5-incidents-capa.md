# Agent 5: Incident Management, CAPA & Near-Miss Reporting

> **Include `_context.md` before reading this prompt.**

## Your Mission

Build the incident response ecosystem: rapid-reporting countdown timer, duplicate case detection, corrective action tracking (CAPA), and a dedicated near-miss reporting form accessible to all field workers. This work closes the loop from incident → investigation → corrective action → prevention.

## Your Migration Timestamp Range

Use timestamps `20260216500000` through `20260216509999`.

## FILES YOU OWN (only modify these)

**You may create or modify:**
- `supabase/migrations/20260216500*` (your new migrations)
- `src/components/safety/RapidReportingTimer.tsx` (new file)
- `src/components/safety/CorrectiveActionList.tsx` (new file)
- `src/components/safety/CorrectiveActionForm.tsx` (new file)
- `src/pages/forms/NearMissReportForm.tsx` (new file)
- `src/hooks/queries/useRapidReporting.ts` (new file)
- `src/hooks/queries/useCorrectiveActions.ts` (new file)
- `src/hooks/queries/useDuplicateIncidentCheck.ts` (new file)
- `src/hooks/nearMiss/useNearMissValidation.ts` (new file)
- `src/hooks/nearMiss/useNearMissSubmission.ts` (new file)
- `src/types/correctiveAction.ts` (new file)
- `src/types/nearMiss.ts` (new file)
- `tests/unit/incident-*` (new test files)
- `tests/unit/capa-*` (new test files)
- `tests/unit/near-miss-*` (new test files)
- `tests/e2e/incident-*` (new test files)
- `tests/e2e/near-miss-*` (new test files)

**You may READ but NOT MODIFY:**
- `src/components/admin/IncidentLoggingModal.tsx` — Agent 2 is adding Form 301 fields here. You create a HOOK for duplicate detection that will be integrated later. Do NOT modify this file directly.
- `src/components/admin/SafetyIncidentsList.tsx` — read for incident data patterns
- `src/hooks/queries/useRiskCalibration.ts` — read for incident query patterns
- `src/lib/offlineQueue.ts`, `src/lib/offlinePhotoStore.ts` — read to replicate offline pattern
- `src/components/forms/VoiceInputButton.tsx` — read to reuse in near-miss form
- All other files — for pattern reference only

**COORDINATION NOTE:** Agent 2 owns `IncidentLoggingModal.tsx`. Your duplicate detection hook (`useDuplicateIncidentCheck`) should be a standalone hook that Agent 2 can import later. Document the hook's API clearly. Agent 6 will import your `RapidReportingTimer`, `CorrectiveActionList`, and near-miss widgets into the SO dashboard.

---

## Task 5A: Rapid-Reporting Countdown Timer

**Problem:** When a fatality, hospitalization, amputation, or eye loss is logged, OSHA requires reporting within 8 hours (fatality) or 24 hours (others). The current system shows a static warning but has no countdown, no tracking, and no post-entry alerts.

**Before coding, read:**
- `src/hooks/queries/useRiskCalibration.ts` — find how incidents are queried, especially `determineOshaReportable()`
- `safety_incidents` schema — find `osha_reportable`, `osha_reported`, `osha_report_date`, `reported_at`, `severity` columns
- `src/lib/complianceHelpers.ts` — understand timezone handling

**Implementation:**

1. **Create hook** `src/hooks/queries/useRapidReporting.ts`:
   ```typescript
   interface RapidReportingEvent {
     id: string;
     case_number: string;
     severity: string;
     reported_at: string;
     osha_reported: boolean;
     osha_report_date: string | null;
     deadline_hours: number;  // 8 for fatality, 24 for others
     elapsed_hours: number;
     remaining_hours: number;
     urgency: 'green' | 'yellow' | 'red' | 'overdue';
   }
   ```
   - Query: `safety_incidents WHERE osha_reportable = true AND osha_reported = false`
   - Calculate elapsed time from `reported_at` in `America/Chicago` timezone
   - Deadline: 8 hours for `severity = 'fatality'`, 24 hours for hospitalization/amputation/eye loss
   - Urgency: green (>50% time remaining), yellow (25-50%), red (<25%), overdue (0% or negative)
   - `useMarkAsReported(incidentId)` — mutation setting `osha_reported = true` and `osha_report_date = now()`
   - Auto-refresh every 60 seconds (interval)

2. **Create component** `src/components/safety/RapidReportingTimer.tsx`:
   - For each unreported event, display a card:
     - Case number and severity badge
     - Large countdown: "7:42:13 remaining" or "OVERDUE by 2:15:00"
     - Color-coded background matching urgency level
     - OSHA reporting phone: **1-800-321-OSHA (6742)**
     - OSHA online reporting link: `https://www.osha.gov/ords/ser/serform.html`
     - "Mark as Reported to OSHA" button → sets `osha_reported = true`
   - If no unreported events exist, show nothing (don't render an empty state).
   - The component is self-contained with its own data fetching for easy import by Agent 6.

**Done when:**
- [ ] Hook fetches unreported OSHA events with countdown calculation
- [ ] Timer updates every 60 seconds
- [ ] Urgency levels calculated correctly (green/yellow/red/overdue)
- [ ] Component displays countdown with color coding
- [ ] OSHA phone number and link displayed
- [ ] "Mark as Reported" sets osha_reported to true
- [ ] Component renders nothing when no events
- [ ] `npm run typecheck` passes

---

## Task 5B: Duplicate Incident Detection Hook

**Problem:** OSHA 29 CFR 1904.6 requires 180-day new-case assessment. The system has no duplicate detection.

**Implementation:**

1. **Create hook** `src/hooks/queries/useDuplicateIncidentCheck.ts`:
   ```typescript
   interface DuplicateCheckResult {
     hasPotentialDuplicates: boolean;
     matches: Array<{
       id: string;
       case_number: string;
       incident_date: string;
       body_parts_affected: string[];
       injury_illness_type: string;
       severity: string;
     }>;
   }

   /**
    * Check for potential duplicate incidents within 180 days.
    *
    * Usage (for Agent 2 to integrate into IncidentLoggingModal):
    * const { checkForDuplicates, result, isChecking } = useDuplicateIncidentCheck();
    * // Call when employee and body parts are selected:
    * await checkForDuplicates({ employeeId, bodyParts, injuryType });
    */
   function useDuplicateIncidentCheck() { ... }
   ```
   - Query `safety_incidents` for the same `involved_user_ids` within the past 180 days.
   - Match on overlapping `body_parts_affected` OR same `injury_illness_type`.
   - Return matches sorted by date (most recent first).
   - The hook should be fully documented so Agent 2 can integrate it into `IncidentLoggingModal.tsx` later.

2. **Create a companion display component** `src/components/safety/DuplicateIncidentWarning.tsx`:
   - Accepts `matches` from the hook.
   - Displays: "A similar incident was recorded for this employee on [date] (Case #[number]). Is this a new case or a continuation?"
   - Two buttons: "This is a new case" (dismiss) and "Link to existing case #[number]" (returns the selected case ID).
   - Export both hook and component for integration.

**Done when:**
- [ ] Hook queries safety_incidents with 180-day window
- [ ] Matches on overlapping body parts or same injury type
- [ ] Warning component displays matches with new/link options
- [ ] API is documented with usage example for Agent 2
- [ ] `npm run typecheck` passes

---

## Task 5C: Corrective Action Tracking (CAPA)

**Problem:** `corrective_actions_taken` is just a text field on incidents. No structured tracking, no assignment, no due dates, no verification workflow.

**Before coding, read:**
- `src/components/admin/SafetyIncidentsList.tsx` — understand incident detail modal
- The incident detail modal rendering pattern

**Implementation:**

1. **Migration** `supabase/migrations/20260216500000_corrective_actions.sql`:
   ```sql
   CREATE TABLE corrective_actions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     incident_id UUID REFERENCES safety_incidents(id),
     description TEXT NOT NULL,
     action_type TEXT NOT NULL CHECK (action_type IN ('immediate', 'short_term', 'long_term', 'systemic')),
     assigned_to UUID REFERENCES app_users(id),
     assigned_by UUID REFERENCES app_users(id) NOT NULL,
     due_date DATE NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'completed', 'verified', 'overdue')) DEFAULT 'open',
     completed_at TIMESTAMPTZ,
     completion_notes TEXT,
     verified_by UUID REFERENCES app_users(id),
     verified_at TIMESTAMPTZ,
     verification_notes TEXT,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );

   ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;

   -- Admin, SO, GF can manage all corrective actions
   CREATE POLICY corrective_actions_management ON corrective_actions
     FOR ALL USING (
       is_admin()
       OR current_setting('request.jwt.claims')::jsonb->>'role' = 'safety_officer'
       OR current_setting('request.jwt.claims')::jsonb->>'role' = 'general_foreman'
     );

   -- Assigned user can view and update their own actions
   CREATE POLICY corrective_actions_assignee ON corrective_actions
     FOR ALL USING (assigned_to = auth.uid());

   -- No standalone DELETE policy (management FOR ALL covers it for authorized roles)
   -- Consider: should we block DELETE? If CAPA records should be permanent, split the management policy.
   ```
   **IMPORTANT:** Check how the existing codebase references roles in RLS policies. If helpers like `is_safety_officer()` exist, use those. Match the existing pattern exactly.

   Add INSERT and UPDATE audit triggers following the existing pattern for safety tables.

2. **Create types** `src/types/correctiveAction.ts`:
   ```typescript
   export type ActionType = 'immediate' | 'short_term' | 'long_term' | 'systemic';
   export type ActionStatus = 'open' | 'in_progress' | 'completed' | 'verified' | 'overdue';

   export interface CorrectiveAction {
     id: string;
     incident_id: string;
     description: string;
     action_type: ActionType;
     assigned_to: string | null;
     assigned_to_name?: string;
     assigned_by: string;
     assigned_by_name?: string;
     due_date: string;
     status: ActionStatus;
     completed_at: string | null;
     completion_notes: string | null;
     verified_by: string | null;
     verified_at: string | null;
     verification_notes: string | null;
     created_at: string;
     is_overdue: boolean;  // computed: status != 'completed'|'verified' AND due_date < today
   }
   ```

3. **Create hook** `src/hooks/queries/useCorrectiveActions.ts`:
   - `useCorrectiveActions(incidentId?)` — fetch actions, optionally filtered by incident
   - `useOpenCorrectiveActions()` — fetch all open/overdue actions (for dashboard widget)
   - `useCreateCorrectiveAction()` — mutation
   - `useUpdateCorrectiveActionStatus()` — mutation for status changes
   - `useVerifyCorrectiveAction()` — mutation for verification

4. **Create component** `src/components/safety/CorrectiveActionForm.tsx`:
   - Modal form for creating/editing a corrective action.
   - Fields: description (textarea), action type (dropdown), assign to (employee dropdown), due date (date picker), notes.
   - For existing actions: show status update controls and verification section.

5. **Create component** `src/components/safety/CorrectiveActionList.tsx`:
   - Table/list of corrective actions with columns: Description, Type, Assigned To, Due Date, Status.
   - Color-coded status badges (red for overdue, yellow for open, green for verified).
   - Click to open detail/edit form.
   - Filter by status (all, open, overdue, completed, verified).
   - Self-contained with own data fetching for dashboard integration.
   - Props: `incidentId?: string` (when embedded in incident detail) or none (for dashboard showing all).

**Done when:**
- [ ] Migration creates table with RLS and audit triggers
- [ ] Types defined
- [ ] Hooks for CRUD operations work
- [ ] Create/edit form component works
- [ ] List component with filtering works
- [ ] Overdue calculation correct
- [ ] Status workflow: open → in_progress → completed → verified
- [ ] Components self-contained for Agent 6 dashboard integration
- [ ] `npm run typecheck` passes

---

## Task 5D: Near-Miss Reporting Form

**Problem:** Near-misses use the full incident logging modal, which is complex and restricted to admin/GF/SO/foreman roles. Field employees cannot report near-misses.

**Before coding, read:**
- `src/pages/forms/DailyJSAForm.tsx` — use as pattern for form structure and offline support
- `src/hooks/jsa/useJSASubmission.ts` — replicate offline queue pattern
- `src/components/forms/VoiceInputButton.tsx` — understand voice input API for description field
- How `can_log_incidents()` works (search for it in migrations)

**Implementation:**

1. **Migration** `supabase/migrations/20260216500001_near_miss_access.sql`:
   - Create a `can_report_near_miss()` function that returns true for ALL authenticated roles (not just incident loggers).
   - Add a new RLS policy on `safety_incidents` for INSERT that allows any authenticated user to insert records with `severity = 'near_miss'`:
     ```sql
     CREATE POLICY safety_incidents_near_miss_insert ON safety_incidents
       FOR INSERT WITH CHECK (
         auth.uid() IS NOT NULL
         AND (NEW.severity = 'near_miss')
       );
     ```
     **IMPORTANT:** Verify this doesn't conflict with existing INSERT policies. Check what policies already exist and ensure this is additive, not conflicting.

2. **Create types** `src/types/nearMiss.ts`:
   ```typescript
   export type NearMissCategory =
     | 'fall_hazard' | 'struck_by' | 'electrical' | 'caught_in'
     | 'vehicle' | 'environmental' | 'ergonomic' | 'other';

   export interface NearMissReport {
     category: NearMissCategory;
     description: string;
     location: string;
     latitude: number | null;
     longitude: number | null;
     suggested_corrective_action: string;
     photos: string[];  // URLs or blob references
   }
   ```

3. **Create form** `src/pages/forms/NearMissReportForm.tsx`:
   - **Lightweight, mobile-first design.** This is for field workers on phones.
   - Fields:
     - Date and time (auto-filled, editable)
     - Location: GPS auto-fill button + text field for manual override/description
     - Category: dropdown from `NearMissCategory`
     - Description: textarea + `VoiceInputButton` for hands-free entry
     - Photos: reuse existing photo upload infrastructure (2-3 photo slots)
     - Suggested corrective action: optional textarea
     - Reporter signature: reuse `SignaturePad`
   - On submission: create a `safety_incidents` record with `severity = 'near_miss'`, `incident_type = 'near_miss'`, and the near-miss data in a JSONB field or mapped to existing columns.

4. **Create submission hook** `src/hooks/nearMiss/useNearMissSubmission.ts`:
   - Replicate offline queue pattern from `useJSASubmission.ts`.
   - Queue to IndexedDB when offline, auto-sync on reconnect.
   - Photo persistence via `offlinePhotoStore`.

5. **Create validation hook** `src/hooks/nearMiss/useNearMissValidation.ts`:
   - Required: category, description (min 10 chars), location, signature.
   - Optional: photos, suggested corrective action.

6. **Register the route** and add to the Forms hub (`src/pages/forms/Forms.tsx`). Accessible to ALL roles.

7. **Notification:** On successful submission, notify the Safety Officer. Check if a notification mechanism exists (search for notification patterns, push notifications, or toast-based alerts for other users). If not, add a TODO comment for notification integration.

**Done when:**
- [ ] Near-miss form accessible to ALL authenticated roles
- [ ] RLS policy allows any user to insert near-miss severity incidents
- [ ] GPS auto-fill works for location
- [ ] Voice input works for description
- [ ] Photo upload works (reusing existing infrastructure)
- [ ] Offline submission queues to IndexedDB
- [ ] Auto-sync on reconnect
- [ ] Submission creates safety_incidents record with severity='near_miss'
- [ ] Route registered and accessible from Forms hub
- [ ] `npm run typecheck` passes

---

## Task 5E: Near-Miss Analytics Components

**Implementation:**

1. **Create component** `src/components/safety/NearMissTrend.tsx`:
   - Query `safety_incidents WHERE severity = 'near_miss'` for last 12 months.
   - Display monthly count as a bar or line chart (use Recharts if available, otherwise a simple bar chart).
   - Self-contained with own data fetching.

2. **Create component** `src/components/safety/NearMissCategoryBreakdown.tsx`:
   - Pie or horizontal bar chart showing near-miss count by category.
   - For the current quarter or configurable date range.
   - Self-contained.

Both components for Agent 6 to import into the SO dashboard.

**Done when:**
- [ ] Trend chart shows monthly near-miss counts
- [ ] Category breakdown shows distribution
- [ ] Both components self-contained
- [ ] `npm run typecheck` passes

---

## Task 5F: Write Tests

**Implementation:**

1. `tests/unit/incident-rapid-reporting.test.ts`:
   - Test deadline calculation (8hr fatality, 24hr others)
   - Test urgency levels (green/yellow/red/overdue)
   - Test elapsed time computation with timezone handling

2. `tests/unit/incident-duplicate-check.test.ts`:
   - Test 180-day window filter
   - Test body part overlap matching
   - Test injury type matching
   - Test with no matches

3. `tests/unit/capa-status-workflow.test.ts`:
   - Test status transitions (open → in_progress → completed → verified)
   - Test overdue calculation
   - Test assignment validation

4. `tests/unit/near-miss-validation.test.ts`:
   - Test required fields
   - Test description minimum length
   - Test category validation

5. `tests/e2e/near-miss-report.spec.ts`:
   - Happy path submission
   - Offline submission and sync
   - Employee role can access form (not just admin)

6. `tests/e2e/incident-logging.spec.ts`:
   - Full incident creation flow
   - Recordable field enforcement
   - OSHA 300 export

**Done when:**
- [ ] All test files exist
- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
