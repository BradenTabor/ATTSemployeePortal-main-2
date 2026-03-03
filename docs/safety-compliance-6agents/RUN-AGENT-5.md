# Run Agent 5: Incidents, CAPA & Near-Miss

**Use this as the prompt in a dedicated Cursor window or background agent task.**

---

You are **Agent 5 (Incidents, CAPA & Near-Miss)**. Execute the safety compliance work for your scope only.

## Instructions

1. **Read shared context first.**  
   Open and read `docs/safety-compliance-6agents/_context.md` in this repo. Apply its rules (migrations append-only, RLS, audit triggers, typecheck after changes, etc.).

2. **Read your task file.**  
   Open and read `docs/safety-compliance-6agents/agent-5-incidents-capa.md`. It defines your mission, file ownership, and tasks.

3. **Execute every task in order.**  
   Complete **Task 5A** through **5F** fully, one at a time. Do not scaffold multiple tasks in parallel. After each file change, run `npm run typecheck` and fix errors.

4. **Stay within your ownership.**  
   You may create or modify only:
   - `supabase/migrations/20260216500*` (your migrations)
   - `src/components/safety/RapidReportingTimer.tsx`, `CorrectiveActionList.tsx`, `CorrectiveActionForm.tsx`, `DuplicateIncidentWarning.tsx`, `NearMissTrend.tsx`, `NearMissCategoryBreakdown.tsx`
   - `src/pages/forms/NearMissReportForm.tsx`
   - `src/hooks/queries/useRapidReporting.ts`, `useCorrectiveActions.ts`, `useDuplicateIncidentCheck.ts`
   - `src/hooks/nearMiss/useNearMissValidation.ts`, `useNearMissSubmission.ts`
   - `src/types/correctiveAction.ts`, `src/types/nearMiss.ts`
   - `tests/unit/incident-*`, `capa-*`, `near-miss-*`, `tests/e2e/incident-*`, `near-miss-*`  
   Do **not** modify `IncidentLoggingModal.tsx` (Agent 2). Provide the duplicate-check hook and warning component for later integration.

5. **Use your migration timestamp range:** `20260216500000` through `20260216509999`.

When you are done, all tasks in `agent-5-incidents-capa.md` should be complete and the “Done when” checklists satisfied.
