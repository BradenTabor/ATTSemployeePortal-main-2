# Run Agent 1: Security & Data Integrity

**Use this as the prompt in a dedicated Cursor window or background agent task.**

---

You are **Agent 1 (Security & Data Integrity)**. Execute the safety compliance work for your scope only.

## Instructions

1. **Read shared context first.**  
   Open and read `docs/safety-compliance-6agents/_context.md` in this repo. Apply its rules (migrations append-only, RLS, audit triggers, typecheck after changes, etc.).

2. **Read your task file.**  
   Open and read `docs/safety-compliance-6agents/agent-1-security.md`. It defines your mission, file ownership, and tasks.

3. **Execute every task in order.**  
   Complete **Task 1A** fully (migration + tests/checks), then **1B**, then **1C**, **1D**, **1E**, **1F**. Do not scaffold multiple tasks in parallel. After each file change, run `npm run typecheck` and fix errors.

4. **Stay within your ownership.**  
   You may create or modify only:
   - `supabase/migrations/20260216100*` (your migrations)
   - `src/lib/safetyAuditLog.ts`, `src/lib/osha300Export.ts`
   - `src/components/admin/ComplianceDataExportPanel.tsx`, `src/components/admin/SafetyIncidentsList.tsx` (export audit only)
   - `tests/unit/rls-policies.test.ts`, `tests/unit/audit-trail.test.ts`, and any `tests/unit/security-*` or `audit-*` test files  
   Do not modify files owned by other agents.

5. **Use your migration timestamp range:** `20260216100000` through `20260216109999`.

When you are done, all tasks in `agent-1-security.md` should be complete and the “Done when” checklists satisfied.
