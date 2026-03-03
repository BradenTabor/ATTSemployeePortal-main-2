# Agent 6: Safety Officer Dashboard & Medium-Priority Features

> **Include `_context.md` before reading this prompt.**

## Your Mission

Transform the Safety Officer Dashboard from a navigation hub (currently 34% — 21/62 points) into an operational command center. Unlock hidden features that exist on admin-only pages, build new dashboard widgets, and implement medium-priority safety features (PPE, heat illness, EAP, inspection readiness).

## Your Migration Timestamp Range

Use timestamps `20260216600000` through `20260216609999`.

## FILES YOU OWN (only modify these)

**You may create or modify:**
- `supabase/migrations/20260216600*` (your new migrations)
- `src/pages/safety-officer/SafetyOfficerDashboard.tsx` (major overhaul)
- `src/pages/admin/SafetyAnalyticsDashboard.tsx` (remove SO role block ONLY)
- `src/pages/safety-officer/EmergencyActionPlan.tsx` (new file)
- `src/pages/safety-officer/InspectionReadiness.tsx` (new file)
- `src/components/dashboard/DaysSinceIncident.tsx` (new file)
- `src/components/dashboard/OverdueFormAlerts.tsx` (new file)
- `src/components/dashboard/CertExpirationWarnings.tsx` (new file)
- `src/components/dashboard/IncidentTrendChart.tsx` (new file)
- `src/components/dashboard/BodyPartHeatMap.tsx` (new file)
- `src/components/dashboard/ComplianceRatesWidget.tsx` (new file)
- `src/components/dashboard/RiskScoreWidget.tsx` (new file)
- `src/components/dashboard/CrewSiteOverview.tsx` (new file)
- `src/components/safety/HeatIllnessAlert.tsx` (new file)
- `src/components/safety/PPEAutoSuggest.tsx` (new file)
- `src/hooks/dashboard/useDashboardWidgets.ts` (new file)
- `src/types/dashboard.ts` (new file)
- `tests/e2e/safety-officer-dashboard.spec.ts` (new file)

**You may READ but NOT MODIFY:**
- `src/pages/admin/AdminComplianceAudit.tsx` — read for RPC and data patterns to replicate
- `src/pages/admin/AdminJSA.tsx` — read for JSA viewer pattern
- `src/pages/mechanic/MechanicDashboard.tsx` — read for `PendingDefectsWidget` pattern
- `src/hooks/queries/useComplianceQuery.ts` — read for compliance data hooks
- `src/hooks/queries/useSafetyAnalytics.ts` — read for analytics hooks
- `src/hooks/queries/useRiskCalibration.ts` — read for risk score hooks
- `src/services/safety-agent/execution/calculateRiskScore.ts` — read for risk algorithm
- `src/lib/complianceHelpers.ts` — read for timezone utilities
- All other files — for pattern reference only

**COMPONENTS TO IMPORT FROM OTHER AGENTS (create placeholder imports with TODO if not available yet):**
- Agent 2: `src/components/safety/PostingReminder.tsx` — 300A posting banner
- Agent 3: `src/components/ui/QualificationBadge.tsx` — worker qualification badge
- Agent 5: `src/components/safety/RapidReportingTimer.tsx` — OSHA countdown timer
- Agent 5: `src/components/safety/CorrectiveActionList.tsx` — CAPA widget
- Agent 5: `src/components/safety/NearMissTrend.tsx` — near-miss trend chart
- Agent 5: `src/components/safety/NearMissCategoryBreakdown.tsx` — near-miss categories

For each import: try importing the real component first. If the file doesn't exist yet (other agent hasn't created it), create a placeholder:
```typescript
// TODO: Import from Agent [N] when available
// import { RapidReportingTimer } from '@/components/safety/RapidReportingTimer';
const RapidReportingTimer = () => <div className="p-4 bg-gray-100 rounded">Rapid Reporting Timer — pending integration</div>;
```

---

## Task 6A: Unlock Hidden Features (Quick Wins)

**Problem:** 6 features exist on admin-only pages but are inaccessible to the Safety Officer role.

**Before coding, read each file listed to understand what's there:**
- `src/pages/admin/SafetyAnalyticsDashboard.tsx` — find the role check that blocks SO
- `src/pages/admin/AdminComplianceAudit.tsx` — find the compliance summary RPC calls and how data displays
- `src/pages/admin/AdminJSA.tsx` — find the JSA viewer/search functionality
- `src/pages/mechanic/MechanicDashboard.tsx` — find `PendingDefectsWidget` and DVIR metrics
- `src/hooks/queries/useSafetyAnalytics.ts` — find the `safety_score` composite calculation
- `src/hooks/queries/useRiskCalibration.ts` — find risk score hooks
- The router configuration — understand how role-based routing works

**Implementation:**

1. **Unblock Safety Analytics:** In `SafetyAnalyticsDashboard.tsx`, find the role check `if (currentUserRole !== "admin")` (or similar) and change it to also allow `safety_officer`. This is likely a single line change.

2. **Compliance Rates Widget** — Create `src/components/dashboard/ComplianceRatesWidget.tsx`:
   - Call the existing `get_compliance_summary_by_day` RPC (or whatever hook `AdminComplianceAudit` uses).
   - Display three cards: JSA completion %, DVIR completion %, Equipment inspection completion %.
   - Each card shows: today's percentage (large number), 7-day trend sparkline (small line chart below).
   - Use the same data source as the admin page — just present it differently.

3. **Risk Score Widget** — Create `src/components/dashboard/RiskScoreWidget.tsx`:
   - Use `useRiskScoreHistory` hook (already exists).
   - Display current risk score for each active site/crew.
   - Color coding: green (low), yellow (medium), red (high).
   - Click a site to see risk drivers.

4. **JSA Viewer Access:**
   - Check if the SO role can be added to the routing guard for `AdminJSA.tsx`.
   - If routing is role-based, add `safety_officer` to the allowed roles for that route.
   - If the page has internal role checks, add `safety_officer` there too.

5. **DVIR Status Access:**
   - Check if `PendingDefectsWidget` or DVIR metrics can be queried by the SO role (check RLS on `dvir_reports`).
   - If SO has read access, create a compact widget showing today's DVIR count and open defect count.

**Done when:**
- [ ] SafetyAnalyticsDashboard accessible to safety_officer role
- [ ] Compliance rates widget shows JSA/DVIR/Equipment % with 7-day trend
- [ ] Risk score widget shows per-site scores with color coding
- [ ] JSA viewer accessible to SO role
- [ ] DVIR status/defects visible to SO role
- [ ] `npm run typecheck` passes

---

## Task 6B: New Dashboard Widgets

**Implementation — create each as a self-contained component:**

1. **Days Since Last Recordable** — `src/components/dashboard/DaysSinceIncident.tsx`:
   - Query `safety_incidents WHERE severity IN ('recordable', 'lost_time', 'fatality') ORDER BY incident_date DESC LIMIT 1`
   - Calculate days between last incident and today (using `America/Chicago`).
   - Display as a large number with milestone markers at 30, 60, 90, 180, 365 days.
   - Color: green if >30 days, with increasing green intensity at milestones.
   - If zero recordable incidents exist, show "No recordable incidents on record."

2. **Overdue Form Alerts** — `src/components/dashboard/OverdueFormAlerts.tsx`:
   - Query the latest `compliance_runs` entry (created by the 9 AM cron).
   - Parse the compliance data to find users who haven't submitted required forms today.
   - Display as a list: employee name, missing form type, last submission date.
   - If no compliance run exists for today, show: "Compliance check hasn't run yet today."

3. **Certification Expiration Warnings** — `src/components/dashboard/CertExpirationWarnings.tsx`:
   - Query `certification_records WHERE expires_at BETWEEN now() AND now() + interval '90 days'`
   - Group by timeframe: 0-30 days (red), 31-60 days (yellow), 61-90 days (green).
   - Display: employee name, certification type, expiration date, days remaining.
   - Sorted by expiration date (soonest first).

4. **Incident Trend Chart** — `src/components/dashboard/IncidentTrendChart.tsx`:
   - Query `safety_incidents` grouped by month for the past 12 months.
   - Stacked bar chart or line chart with series by severity (near_miss, first_aid, recordable, lost_time, fatality).
   - Use Recharts if available (check `package.json`), otherwise Chart.js.
   - Include legend.

5. **Body Part Injury Heat Map** — `src/components/dashboard/BodyPartHeatMap.tsx`:
   - Query `safety_incidents` and aggregate `body_parts_affected` counts.
   - Display as a horizontal bar chart (simpler and more readable than a body outline).
   - Top 10 body parts by frequency.
   - Each bar colored by severity mix.

**Done when:**
- [ ] Days Since Last Recordable shows correct count with milestones
- [ ] Overdue Form Alerts shows non-compliant users from latest compliance run
- [ ] Cert Expiration Warnings shows 30/60/90 day bands
- [ ] Incident Trend Chart shows 12-month history by severity
- [ ] Body Part chart shows top 10 affected areas
- [ ] All components self-contained with own data fetching
- [ ] `npm run typecheck` passes

---

## Task 6C: Crew & Site Oversight

**Implementation:**

1. **Create** `src/components/dashboard/CrewSiteOverview.tsx`:
   - Query `daily_jsa` for today's submissions, grouped by crew/site.
   - Query `dvir_reports` for today's submissions, grouped by vehicle/crew.
   - Display a table: Crew/Site | JSA Status (submitted/missing) | DVIR Status (submitted/missing) | Open Defects.
   - Check how crew assignments are tracked (look at `app_users` for crew fields, `daily_jsa` for `work_site_name` or `crew` fields).
   - If no formal crew-to-site mapping exists, group by `work_site_name` from today's JSAs.

2. **Migration** `supabase/migrations/20260216600000_safety_flags.sql`:
   ```sql
   CREATE TABLE safety_flags (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     flagged_by UUID REFERENCES app_users(id) NOT NULL,
     form_type TEXT NOT NULL CHECK (form_type IN ('jsa', 'dvir', 'equipment', 'incident', 'near_miss')),
     form_id UUID NOT NULL,
     reason TEXT NOT NULL,
     status TEXT CHECK (status IN ('open', 'reviewed', 'resolved')) DEFAULT 'open',
     reviewed_by UUID REFERENCES app_users(id),
     reviewed_at TIMESTAMPTZ,
     review_notes TEXT,
     created_at TIMESTAMPTZ DEFAULT now()
   );

   ALTER TABLE safety_flags ENABLE ROW LEVEL SECURITY;

   -- SO, Admin, GF can manage flags
   CREATE POLICY safety_flags_management ON safety_flags
     FOR ALL USING (
       is_admin()
       OR current_setting('request.jwt.claims')::jsonb->>'role' IN ('safety_officer', 'general_foreman')
     );
   -- Any authenticated user can create flags
   CREATE POLICY safety_flags_create ON safety_flags
     FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
   ```
   **IMPORTANT:** Match the role-checking pattern used elsewhere. If helpers exist, use them.

3. Add a "Flag for Review" button component that can be placed on any form detail view. On click, opens a modal with a reason field and creates a `safety_flags` entry.

4. Show flagged items on the SO dashboard as a separate section or badge count.

**Done when:**
- [ ] Crew/site overview shows today's JSA and DVIR status
- [ ] Safety flags table exists with RLS
- [ ] Flag button component created
- [ ] Flagged items visible on SO dashboard
- [ ] `npm run typecheck` passes

---

## Task 6D: Assemble the Dashboard

**Now bring it all together in `SafetyOfficerDashboard.tsx`.**

**Before coding, read:**
- The current `SafetyOfficerDashboard.tsx` — understand its layout, existing components, and routing

**Implementation:**

Reorganize the dashboard into sections (use a grid/flex layout):

1. **Top row — Critical Alerts (full width):**
   - `RapidReportingTimer` (Agent 5) — only shows if events exist
   - `PostingReminder` (Agent 2) — only shows during Feb 1–Apr 30

2. **Second row — Key Metrics (3-4 columns):**
   - `DaysSinceIncident`
   - `ComplianceRatesWidget` (JSA/DVIR/Equipment %)
   - `RiskScoreWidget`
   - `CertExpirationWarnings` (compact: count + "View all" link)

3. **Third row — Actionable Lists (2 columns):**
   - `OverdueFormAlerts`
   - `CorrectiveActionList` (Agent 5) — showing open/overdue only

4. **Fourth row — Analytics (2 columns):**
   - `IncidentTrendChart`
   - `NearMissTrend` (Agent 5) + `NearMissCategoryBreakdown` (Agent 5)

5. **Fifth row — Detailed Views:**
   - `CrewSiteOverview`
   - `BodyPartHeatMap`
   - Existing `SafetyIncidentsList` (keep this)

6. **Navigation section** (keep existing links to forms, analytics, compliance pages).

Use responsive grid: 1 column on mobile, 2 columns on tablet, 3-4 columns on desktop.

For components from other agents that don't exist yet, use placeholder components (see FILES YOU OWN section above for the pattern).

**Done when:**
- [ ] Dashboard has all sections laid out
- [ ] Critical alerts at top
- [ ] Key metrics visible without scrolling
- [ ] Actionable lists prominently placed
- [ ] Analytics charts below the fold
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Placeholder components used for unavailable Agent imports
- [ ] Existing functionality preserved (incident list, navigation)
- [ ] `npm run typecheck` passes

---

## Task 6E: Emergency Action Plan Page

**Implementation:**

1. **Create** `src/pages/safety-officer/EmergencyActionPlan.tsx`:
   - Mobile-optimized page with large, tappable elements.
   - Sections:
     - **Emergency Contacts:** Company emergency line, Safety Officer phone, 911 prompt.
     - **Nearest Hospital:** Text display with "Get Directions" button (opens Google Maps/Apple Maps with GPS coordinates).
     - **Utility Company Contacts:** List of utility companies with phone numbers (pull from a config or allow SO to maintain).
     - **Evacuation Procedures:** Static content (editable by admin) covering: assembly points, headcount procedure, severe weather shelter.
     - **OSHA Reporting:** Phone number (1-800-321-OSHA), online link, when to call (fatality, hospitalization, amputation, eye loss).
   - Consider making this page accessible WITHOUT authentication if possible (check routing constraints). Emergency info should be reachable even if login session has expired.

2. Register route and add to main navigation (not just SO dashboard — all roles should see it).

**Done when:**
- [ ] EAP page renders with all sections
- [ ] "Get Directions" opens maps app
- [ ] Page is mobile-optimized
- [ ] Accessible to all roles (or as many as routing allows)
- [ ] `npm run typecheck` passes

---

## Task 6F: OSHA Inspection Readiness Report

**Implementation:**

1. **Create** `src/pages/safety-officer/InspectionReadiness.tsx`:
   - Checklist-style page that pulls from live data:
     - Is the OSHA 300 Log current? (check `safety_incidents` for unlogged recordables)
     - Is the 300A posted? (check `osha_300a_certifications` for current year)
     - Are training records current? (check `certification_records` for expired certs)
     - Are DVIRs retained for 3 months? (check `data_retention_policies`)
     - Are all employees' electrical qualifications documented? (check `app_users.electrical_qualification_level`)
     - Are equipment inspections current? (check latest `daily_equipment_inspections`)
   - Each item: green check (compliant), yellow warning (attention needed), red X (non-compliant).
   - "Generate Report" button creates a PDF summary using jsPDF.

2. Register route. Accessible to `admin` and `safety_officer`.

**Done when:**
- [ ] Inspection readiness page pulls live compliance status
- [ ] Each checklist item shows green/yellow/red status
- [ ] PDF generation works
- [ ] `npm run typecheck` passes

---

## Task 6G: Heat Illness Prevention Alert

**Implementation:**

1. **Create** `src/components/safety/HeatIllnessAlert.tsx`:
   - Check if weather data is already fetched somewhere (search for weather API calls in `src/services/safety-agent/execution/` — the risk scoring uses weather).
   - If weather data is available: compute heat index from temperature and humidity.
   - Display tiered alerts based on OSHA heat illness thresholds:
     - **Caution (80-89°F heat index):** "Increase water intake. Rest in shade every 30 minutes."
     - **Warning (90-104°F):** "Mandatory 15-minute shade break every hour. Hydration every 15 minutes."
     - **Danger (105°F+):** "Consider postponing non-essential outdoor work. Mandatory buddy system."
   - Component can be added to the JSA weather step or SO dashboard.
   - Self-contained with own weather data fetching (or prop-based if weather data is already available).

2. If no weather API is available from the frontend, create a simple component that accepts `temperature_f` and `humidity_pct` as props and computes the heat index locally.

**Done when:**
- [ ] Heat illness alert displays tiered warnings based on heat index
- [ ] Thresholds match OSHA guidance
- [ ] Component is self-contained or prop-based
- [ ] `npm run typecheck` passes

---

## Task 6H: Write Dashboard Tests

**Implementation:**

1. `tests/e2e/safety-officer-dashboard.spec.ts`:
   - Test SO role can access dashboard
   - Test key widgets render (compliance rates, days since incident, cert warnings)
   - Test critical alerts section renders when events exist
   - Test responsive layout at mobile/tablet/desktop breakpoints

**Done when:**
- [ ] E2E test covers SO dashboard access and widget rendering
- [ ] `npm run test` passes
- [ ] `npm run typecheck` passes
