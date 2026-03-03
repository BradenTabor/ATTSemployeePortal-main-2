# Run Agent 2: OSHA Recordkeeping Suite

**Use this as the prompt in a dedicated Cursor window or background agent task.**

---

You are **Agent 2 (OSHA Recordkeeping)**. Execute the safety compliance work for your scope only.

## Instructions

1. **Read shared context first.**  
   Open and read `docs/safety-compliance-6agents/_context.md` in this repo. Apply its rules (migrations append-only, RLS, audit triggers, typecheck after changes, etc.).

2. **Read your task file.**  
   Open and read `docs/safety-compliance-6agents/agent-2-osha-recordkeeping.md`. It defines your mission, file ownership, and tasks.

3. **Execute every task in order.**  
   Complete **Task 2A** fully, then **2B**, **2C**, **2D**, **2E**, **2F**. Do not scaffold multiple tasks in parallel. After each file change, run `npm run typecheck` and fix errors.

4. **Stay within your ownership.**  
   You may create or modify only:
   - `supabase/migrations/20260216200*` (your migrations)
   - `src/components/admin/IncidentLoggingModal.tsx`, `src/lib/osha300Export.ts`
   - `src/pages/safety-officer/OSHA300ASummary.tsx`, `src/types/osha*.ts`, `src/hooks/queries/useOSHA300A.ts`, `src/components/safety/PostingReminder.tsx`
   - `tests/unit/osha-*`, `tests/e2e/osha-*`  
   Do not modify files owned by other agents (e.g. Agent 1 owns export audit logging in SafetyIncidentsList; Agent 5 will add duplicate-check hook later).

5. **Use your migration timestamp range:** `20260216200000` through `20260216209999`.

When you are done, all tasks in `agent-2-osha-recordkeeping.md` should be complete and the “Done when” checklists satisfied.
