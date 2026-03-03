# ATTS Safety Compliance — 6-Agent Parallel Implementation Guide

## Overview

The safety compliance audit scored 58% across 68 regulatory requirements. This work is split across 6 Cursor agents running in parallel, each owning distinct files to avoid merge conflicts. Target: ~95% compliance.

## Agent Assignments

| Agent | Focus Area | Key Files Owned | Migration Range |
|-------|-----------|----------------|-----------------|
| **1** | Security & Data Integrity | RLS policies, safetyAuditLog, export audit wiring | `20260216100000–109999` |
| **2** | OSHA Recordkeeping | IncidentLoggingModal, osha300Export, 300A pages | `20260216200000–209999` |
| **3** | Electrical Safety | JsaWizard, MAD table, worker qualifications | `20260216300000–309999` |
| **4** | Tree Felling & Equipment | TreeFellingJSAForm, DVIRForm, equipment templates | `20260216400000–409999` |
| **5** | Incidents, CAPA & Near-Miss | New components (timer, CAPA, near-miss form) | `20260216500000–509999` |
| **6** | SO Dashboard & Features | SafetyOfficerDashboard, new widgets, EAP | `20260216600000–609999` |

## Dependency Map

```
Agent 1 (Security) ──── foundational, no dependencies
         │
Agent 2 (OSHA Recordkeeping) ──── needs Agent 1's RLS fix first (migration ordering handles this)
         │
Agent 3 (Electrical) ──── independent, creates LOTOSection for Agent 4
         │
Agent 4 (Tree Felling) ──── imports LOTOSection from Agent 3
         │
Agent 5 (Incidents/CAPA) ──── creates hooks for Agent 2 (duplicate check), components for Agent 6
         │
Agent 6 (Dashboard) ──── imports components from Agents 2, 3, 5 (uses placeholders if unavailable)
```

## File Ownership Boundaries

No two agents modify the same file. Key conflict-prone files are assigned to exactly one agent:

| File | Owner | Other agents... |
|------|-------|-----------------|
| `safety_incidents` RLS policies | Agent 1 | Agent 2 adds columns (separate migration) |
| `IncidentLoggingModal.tsx` | Agent 2 | Agent 5 creates hook, doesn't touch modal |
| `JsaWizard.tsx` | Agent 3 | Agent 4 works on separate TreeFelling form |
| `TreeFellingJSAForm.tsx` | Agent 4 | No one else touches this |
| `SafetyOfficerDashboard.tsx` | Agent 6 | Others create components, Agent 6 imports them |
| `DVIRForm.tsx` | Agent 4 | No one else touches this |
| `SafetyAnalyticsDashboard.tsx` | Agent 6 | Single-line role check change only |
| `useJSAFormValidation.ts` | Agent 3 | Agent 4 creates separate useTreeFellingValidation |

## How to Run

### Option A: 6 Separate Cursor Windows
1. Open 6 Cursor windows/sessions on the same project.
2. In each window, open the corresponding **RUN-AGENT-N.md** file and use it as the prompt (or paste its contents into a new chat).
3. Let them work. Migrations won't conflict due to timestamp ranges.

### Option B: Cursor Background Agents
1. Create 6 background agent tasks.
2. For each task, use the contents of **RUN-AGENT-1.md** through **RUN-AGENT-6.md** as the task prompt.

### Option C: Sequential with Parallelism
1. Start Agents 1, 3, 4, 5 simultaneously (no interdependencies).
2. Start Agent 2 after Agent 1 completes (or simultaneously — migration ordering handles it).
3. Start Agent 6 last (imports from all others), or simultaneously with placeholder components.

## Run Books (prompts)

| Agent | Run book file | Use as prompt in a Cursor window/task |
|-------|----------------|--------------------------------------|
| 1 | `RUN-AGENT-1.md` | Copy entire file → new chat → "Execute all tasks" |
| 2 | `RUN-AGENT-2.md` | Same |
| 3 | `RUN-AGENT-3.md` | Same |
| 4 | `RUN-AGENT-4.md` | Same |
| 5 | `RUN-AGENT-5.md` | Same |
| 6 | `RUN-AGENT-6.md` | Same |

## Post-Merge Checklist

After all 6 agents complete, run these integration checks:

```bash
# 1. All migrations apply cleanly in order
npx supabase db reset

# 2. Type safety
npm run typecheck

# 3. Lint
npm run lint

# 4. Tests pass
npm run test

# 5. Build succeeds
npm run build
```

### Integration Tasks (Manual, Post-Merge)

These require touching files owned by multiple agents — do them AFTER all agents finish:

1. **Wire Agent 5's `useDuplicateIncidentCheck` into Agent 2's `IncidentLoggingModal.tsx`**
   - Import the hook, call it when employee + body parts are selected, display `DuplicateIncidentWarning`.

2. **Replace Agent 6's placeholder components with real imports**
   - Search for `TODO: Import from Agent` in `SafetyOfficerDashboard.tsx` and replace with actual imports.

3. **Wire Agent 3's `LOTOSection` into Agent 4's equipment form**
   - If Agent 4 used a placeholder, replace with the real import.

4. **Verify route registrations don't conflict**
   - Check the router config for duplicate or conflicting paths.

5. **Run full E2E test suite**
   ```bash
   npx playwright test
   ```

## Estimated Timeline

All 6 agents running in parallel: **5–8 working days** of wall-clock time (vs. 75 days sequential as originally scoped). Individual agent task counts:

| Agent | Tasks | Estimated Time |
|-------|-------|---------------|
| 1 | 6 tasks | 1–2 days |
| 2 | 6 tasks | 3–5 days |
| 3 | 5 tasks | 3–5 days |
| 4 | 7 tasks | 4–6 days |
| 5 | 6 tasks | 4–6 days |
| 6 | 8 tasks | 4–6 days |
| **Post-merge** | 5 integration tasks | 1–2 days |
