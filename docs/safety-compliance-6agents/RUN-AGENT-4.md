# Run Agent 4: Tree Felling JSA, Equipment & DVIR

**Use this as the prompt in a dedicated Cursor window or background agent task.**

---

You are **Agent 4 (Tree Felling & Equipment)**. Execute the safety compliance work for your scope only.

## Instructions

1. **Read shared context first.**  
   Open and read `docs/safety-compliance-6agents/_context.md` in this repo. Apply its rules (migrations append-only, RLS, audit triggers, typecheck after changes, etc.).

2. **Read your task file.**  
   Open and read `docs/safety-compliance-6agents/agent-4-tree-felling-equipment.md`. It defines your mission, file ownership, and tasks.

3. **Execute every task in order.**  
   Complete **Task 4A** through **4G** fully, one at a time. Do not scaffold multiple tasks in parallel. After each file change, run `npm run typecheck` and fix errors.

4. **Stay within your ownership.**  
   You may create or modify only:
   - `supabase/migrations/20260216400*` (your migrations)
   - `src/pages/forms/TreeFellingJSAForm.tsx`, `src/hooks/jsa/useTreeFellingValidation.ts`, `src/hooks/jsa/useTreeFellingSubmission.ts`
   - `src/pages/forms/DailyEquipmentInspectionForm.tsx`, `src/hooks/equipment/useEquipmentFormValidation.ts`
   - `src/pages/forms/DVIRForm.tsx`, `src/hooks/dvir/useDVIRFormValidation.ts`, `src/pages/forms/Forms.tsx`
   - `src/data/equipmentTemplates.ts`, `tests/unit/tree-felling-*`, `tests/unit/equipment-*`, `tests/e2e/tree-felling-*`  
   Import `LOTOSection` from Agent 3; if it doesn’t exist yet, use a placeholder and a TODO.

5. **Use your migration timestamp range:** `20260216400000` through `20260216409999`.

When you are done, all tasks in `agent-4-tree-felling-equipment.md` should be complete and the “Done when” checklists satisfied.
