# Preset Templates

> Copy-paste templates for common autopilot interactions

---

## Audit Kickoff Template

Use this when starting a fresh audit session to provide context.

```markdown
## Project Context

**App Name**: <!-- YOUR APP NAME -->
**Purpose**: <!-- One sentence description of what this app does -->

**Tech Stack**:
- Framework: React + TypeScript + Vite
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- State: React Query
- Styling: <!-- Tailwind / CSS Modules / etc -->
- Testing: Vitest

**Primary Users**: <!-- Who uses this app? -->

**Core Workflows**:
1. <!-- Main user workflow 1 -->
2. <!-- Main user workflow 2 -->
3. <!-- Main user workflow 3 -->

**Known Pain Points**:
- <!-- Issue 1 -->
- <!-- Issue 2 -->

**Off-Limits Areas** (do not modify):
- <!-- Path or feature 1 -->
- <!-- Path or feature 2 -->

**Priority Focus**:
- [ ] UX Clarity
- [ ] Workflow Efficiency
- [ ] Performance
- [ ] Test Coverage
- [ ] Security Hardening

---

STATUS
```

---

## Execution Approval Template

Use this when approving a GATED item.

```markdown
## Approval for: <!-- BACKLOG-ID -->

**I have reviewed**:
- [ ] The evidence and observed condition
- [ ] The impact assessment
- [ ] The proposed fix (DOE section)
- [ ] The verification criteria (DoD)
- [ ] The rollback plan

**My concerns** (if any):
<!-- List any concerns or "None" -->

**Constraints for this execution**:
<!-- Any limits on the fix, or "None - proceed as recommended" -->

---

APPROVE: <!-- BACKLOG-ID -->
```

---

## Disagreement Adjudication Template

Use when specialists have conflicting recommendations.

```markdown
## Adjudication Request

**Conflicting Findings**:
- Finding A: <!-- ID --> recommends <!-- summary -->
- Finding B: <!-- ID --> recommends <!-- summary -->

**Conflict Type**:
- [ ] Contradictory approaches (both can't be done)
- [ ] Priority disagreement (order matters)
- [ ] Scope overlap (same code, different changes)

**My Decision**:

I want to proceed with: <!-- Finding ID -->

**Reasoning**:
<!-- Why this approach over the other -->

**Disposition of other finding**:
- [ ] Cancel it (not needed)
- [ ] Defer it (do later, after this one)
- [ ] Modify it (do a version that doesn't conflict)

---

Continue with my decision.
```

---

## Bug Report Template

Use when the autopilot behaves unexpectedly.

```markdown
## Bug Report

**What I Did**:
```
<!-- Paste your command -->
```

**What I Expected**:
<!-- Expected behavior -->

**What Actually Happened**:
<!-- Actual behavior -->

**Current State**:
- Mode: <!-- READ-ONLY / SAFE / FULL -->
- Last successful action: <!-- description -->
- Backlog state: <!-- any corruption? -->
- Scores state: <!-- any corruption? -->

**Agent Output** (relevant section):
```
<!-- Paste agent output -->
```

---

Please diagnose and recover.
```

---

## Score Override Template

Use when you need to manually adjust baseline scores.

```markdown
## Score Adjustment Request

**Current Scores** (from scores.md):
- UX Clarity: <!-- current -->
- Workflow Efficiency: <!-- current -->
- Correctness/Determinism: <!-- current -->

**Requested Adjustment**:
- UX Clarity: <!-- new value --> 
  - Reason: <!-- why -->
- Workflow Efficiency: <!-- new value -->
  - Reason: <!-- why -->
- Correctness/Determinism: <!-- new value -->
  - Reason: <!-- why -->

**Justification**:
<!-- Why the current scores are wrong -->

---

Please update scores.md with these values as the new baseline.
```

---

## Rollback Request Template

Use when you need to undo a change.

```markdown
## Rollback Request

**Item to Rollback**: <!-- BACKLOG-ID -->

**Reason**:
- [ ] Verification passed but behavior is wrong
- [ ] Unexpected side effects discovered
- [ ] Business requirement changed
- [ ] Other: <!-- explain -->

**Details**:
<!-- What's wrong with the change -->

**Rollback Method**:
- [ ] Use documented rollback from changelog
- [ ] Manual git revert
- [ ] Custom fix (describe below)

**Custom Fix** (if applicable):
<!-- Describe what to do instead -->

---

Please execute rollback.
```

---

## Focus Narrowing Template

Use when you want to focus audit on specific areas.

```markdown
## Focused Audit Request

**Focus Specialists**:
- [ ] UX (10-specialist-ux)
- [ ] Workflow (11-specialist-workflow)
- [ ] Architecture (12-specialist-architecture)
- [ ] Performance (13-specialist-performance)
- [ ] QA (14-specialist-qa)
- [ ] Security (15-specialist-security)

**Focus Files/Paths**:
- `<!-- path 1 -->`
- `<!-- path 2 -->`

**Focus Concern**:
<!-- What specifically are you worried about -->

**Ignore**:
- `<!-- path or concern to skip -->`

---

STATUS
```

---

## Session Wrap-Up Template

Use at end of session to get summary.

```markdown
## Session Summary Request

Please provide:

1. **Changes Made This Session**
   - List of backlog items completed
   - Files modified
   
2. **Score Movement**
   - Starting scores
   - Ending scores
   - Net change

3. **Remaining Backlog**
   - Count by severity
   - Top 3 priority items

4. **Recommendations**
   - What to tackle next session
   - Any items needing human attention

5. **Git Commit Message**
   - Suggested commit message for this session's changes

---

STOP
```

---

## Emergency Context Reset

Use if agent seems confused about state.

```markdown
## Context Reset

The autopilot appears to have incorrect state. Please:

1. Re-read `docs/cursor-agents/backlog.md`
2. Re-read `docs/cursor-agents/scores.md`
3. Re-read `docs/cursor-agents/changelog.md`
4. Confirm understanding of current state
5. Output STATUS

Do NOT execute anything. READ-ONLY AUDIT mode until I say GO.
```

---

## Skip/Defer Item Template

Use when you want to skip an item without canceling it.

```markdown
## Defer Item

**Item**: <!-- BACKLOG-ID -->

**Defer Reason**:
- [ ] Not important right now
- [ ] Waiting for external dependency
- [ ] Needs more information
- [ ] Saving for future sprint
- [ ] Other: <!-- explain -->

**Defer Until**:
- [ ] Next session
- [ ] Specific date: <!-- date -->
- [ ] After item: <!-- other ID -->
- [ ] Indefinitely (move to icebox)

---

Please mark item as DEFERRED with this reason.
```
