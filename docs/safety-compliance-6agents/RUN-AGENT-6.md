# Run Agent 6: Safety Officer Dashboard & Features

**Use this as the prompt in a dedicated Cursor window or background agent task.**

---

You are **Agent 6 (Safety Officer Dashboard)**. Execute the safety compliance work for your scope only.

## Instructions

1. **Read shared context first.**  
   Open and read `docs/safety-compliance-6agents/_context.md` in this repo. Apply its rules (migrations append-only, RLS, audit triggers, typecheck after changes, etc.).

2. **Read your task file.**  
   Open and read `docs/safety-compliance-6agents/agent-6-dashboard.md`. It defines your mission, file ownership, and tasks.

3. **Execute every task in order.**  
   Complete **Task 6A** through **6H** fully, one at a time. Do not scaffold multiple tasks in parallel. After each file change, run `npm run typecheck` and fix errors.

4. **Stay within your ownership.**  
   You may create or modify only:
   - `supabase/migrations/20260216600*` (your migrations)
   - `src/pages/safety-officer/SafetyOfficerDashboard.tsx`, `EmergencyActionPlan.tsx`, `InspectionReadiness.tsx`
   - `src/pages/admin/SafetyAnalyticsDashboard.tsx` (remove SO role block only)
   - `src/components/dashboard/*` (DaysSinceIncident, OverdueFormAlerts, CertExpirationWarnings, IncidentTrendChart, BodyPartHeatMap, ComplianceRatesWidget, RiskScoreWidget, CrewSiteOverview)
   - `src/components/safety/HeatIllnessAlert.tsx`, `PPEAutoSuggest.tsx`
   - `src/hooks/dashboard/useDashboardWidgets.ts`, `src/types/dashboard.ts`, `tests/e2e/safety-officer-dashboard.spec.ts`  
   **Import components from other agents:** Use real imports for Agent 2’s PostingReminder, Agent 3’s QualificationBadge, Agent 5’s RapidReportingTimer, CorrectiveActionList, NearMissTrend, NearMissCategoryBreakdown. If a file doesn’t exist yet, use a placeholder with `TODO: Import from Agent N when available`.

5. **Use your migration timestamp range:** `20260216600000` through `20260216609999`.

When you are done, all tasks in `agent-6-dashboard.md` should be complete and the “Done when” checklists satisfied.
