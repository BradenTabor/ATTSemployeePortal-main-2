# Run Agent 3: Electrical Safety & Worker Qualifications

**Use this as the prompt in a dedicated Cursor window or background agent task.**

---

You are **Agent 3 (Electrical Safety)**. Execute the safety compliance work for your scope only.

## Instructions

1. **Read shared context first.**  
   Open and read `docs/safety-compliance-6agents/_context.md` in this repo. Apply its rules (migrations append-only, RLS, audit triggers, typecheck after changes, etc.).

2. **Read your task file.**  
   Open and read `docs/safety-compliance-6agents/agent-3-electrical-safety.md`. It defines your mission, file ownership, and tasks.

3. **Execute every task in order.**  
   Complete **Task 3A** fully, then **3B**, **3C**, **3D**, **3E**. Do not scaffold multiple tasks in parallel. After each file change, run `npm run typecheck` and fix errors.

4. **Stay within your ownership.**  
   You may create or modify only:
   - `supabase/migrations/20260216300*` (your migrations)
   - `src/components/forms/JsaWizard.tsx`, `src/hooks/jsa/useJSAFormValidation.ts`
   - `src/data/madReferenceTable.ts`, `src/components/forms/ElectricalHazardSection.tsx`, `src/components/forms/LOTOSection.tsx`
   - `src/hooks/jsa/useElectricalHazards.ts`, `src/pages/admin/WorkerQualifications.tsx`, `src/hooks/queries/useWorkerQualifications.ts`
   - `src/types/electrical*.ts`, `tests/unit/electrical-*`, `tests/e2e/electrical-*`  
   Do not modify TreeFellingJSAForm or DVIRForm (Agent 4). Agent 4 will import your LOTOSection.

5. **Use your migration timestamp range:** `20260216300000` through `20260216309999`.

When you are done, all tasks in `agent-3-electrical-safety.md` should be complete and the “Done when” checklists satisfied.
