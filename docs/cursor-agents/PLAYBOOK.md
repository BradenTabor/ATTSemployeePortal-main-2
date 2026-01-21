# Cursor Autopilot Playbook

> Step-by-step guide to running the multi-agent governance system

## Quick Start

1. Open this project in Cursor
2. Start a new chat (Cmd+L)
3. Paste a GO command from [GO_COMMANDS.md](./GO_COMMANDS.md)
4. Watch the autopilot work

---

## Understanding Modes

### READ-ONLY AUDIT (Default)

**What happens**: The agent analyzes your codebase and produces findings but makes NO changes.

**When to use**: 
- First time running to see what the agent finds
- When you want to review recommendations before acting
- Periodically to check codebase health

**Output**: Audit reports with findings, backlog items, and scores

### SAFE Autopilot Mode

**What happens**: Agent audits AND executes LOW/MEDIUM severity items automatically.

**What gets auto-executed**:
- UI polish (loading states, feedback)
- Minor refactors
- Test additions
- Documentation updates
- Performance optimizations

**What gets STOPPED (requires APPROVE)**:
- Auth/permissions changes
- RLS policy changes
- Security-sensitive code
- Payment logic
- Schema migrations
- Data deletion
- HIGH/CRITICAL severity items

**When to use**: 
- Daily maintenance
- Incremental improvements
- When you trust LOW/MEDIUM changes

### FULL Autopilot Mode

**What happens**: Agent can execute ANY severity after explicit approval.

**What's different from SAFE**:
- HIGH/CRITICAL items eligible for execution
- Still requires APPROVE for security/auth/schema
- More aggressive improvements possible

**When to use**:
- Major improvement sprints
- When you have time to review and approve
- After SAFE mode has cleared low-hanging fruit

---

## The Recursive Loop

The autopilot follows this exact sequence:

```
1. READ STATE
   ↓
2. RUN SPECIALIST AUDITS (UX, Workflow, Arch, Perf, QA, Security)
   ↓
3. GENERATE/UPDATE BACKLOG
   ↓
4. SELECT NEXT ELIGIBLE ITEM
   ↓
5. EXECUTE (one item only)
   ↓
6. VERIFY (typecheck, lint, test, build)
   ↓
7. UPDATE STATE (changelog, scores)
   ↓
8. RE-AUDIT IMPACTED AREA
   ↓
9. LOOP or STOP
```

---

## Approval Gates

### Items That Always Require APPROVE

| Category | Examples |
|----------|----------|
| Authentication | Login flow, session handling, token refresh |
| Authorization | Role checks, permission guards |
| RLS Policies | Any Supabase policy changes |
| Security | Input validation, XSS prevention |
| Payments | Billing, subscriptions, transactions |
| Data Deletion | Any DELETE operations |
| Schema Changes | Migrations, table alterations |
| HIGH/CRITICAL | Any item rated HIGH or CRITICAL |

### How to Approve

```
APPROVE: BL-042
```

This authorizes execution of backlog item BL-042. The agent will then execute it in the next loop iteration.

### How to Execute Immediately

```
EXECUTE: BL-042
```

This skips queue priority and executes immediately.

---

## STOP Conditions

The autopilot will automatically STOP when:

1. **Missing Requirements** - Can't determine what to do
2. **Ambiguity** - Multiple valid approaches
3. **Failing Verification** - Tests/lint/build fail
4. **External Dependencies** - Needs secrets or API access
5. **Gated Item in SAFE** - HIGH/CRITICAL or security item
6. **Score Regression** - Change would decrease scores
7. **Conflicting Findings** - Specialists disagree

### When STOPPED, You'll See:

```markdown
## ⏭️ NEXT ACTION REQUIRED

**STOP REASON**: [reason]

**What's Needed**: [what you need to provide]

**Options**:
- APPROVE: [ID] - to authorize gated item
- Provide: [missing info]
- STOP - to halt completely
```

---

## Interpreting Output

### Backlog Status

| Status | Meaning |
|--------|---------|
| `NEW` | Just discovered, not yet prioritized |
| `ELIGIBLE` | Ready for execution (meets mode criteria) |
| `GATED` | Requires APPROVE before execution |
| `IN_PROGRESS` | Currently being executed |
| `VERIFYING` | Change made, running verification |
| `COMPLETE` | Successfully executed and verified |
| `BLOCKED` | Has dependencies not yet resolved |
| `FAILED` | Execution or verification failed |

### Severity Levels

| Level | Auto-Execute (SAFE) | Impact |
|-------|---------------------|--------|
| LOW | ✅ Yes | Minor polish, no risk |
| MEDIUM | ✅ Yes | Noticeable improvement, low risk |
| HIGH | ❌ Gated | Significant change, requires review |
| CRITICAL | ❌ Gated | Major impact, careful review needed |

### Scores

| Metric | Target | Description |
|--------|--------|-------------|
| UX Clarity | ≥90 | Interface intuitiveness |
| Workflow Efficiency | ≥90 | Task completion speed |
| Correctness/Determinism | ≥90 | Type safety, test coverage |

**Rule**: Scores must never decrease. Any regression triggers STOP.

---

## Common Workflows

### First-Time Audit

```
1. Start chat
2. Type: STATUS
3. Review initial findings
4. Type: GO: AUTOPILOT SAFE
5. Let it run LOW/MEDIUM items
6. Review approved items if any STOP
```

### Daily Maintenance

```
1. Start chat
2. Type: GO: AUTOPILOT SAFE
3. Let it complete
4. Review changelog
5. Commit changes
```

### Major Improvement Sprint

```
1. Type: GO: AUTOPILOT FULL
2. Review each GATED item as presented
3. Type: APPROVE: [ID] for each approved item
4. Monitor scores for regression
5. STOP when satisfied
```

### Handling Conflicts

When specialists disagree:

```
1. Agent will STOP with conflicting findings
2. Use PRESET_TEMPLATES.md "Disagreement adjudication template"
3. Provide your decision
4. Agent continues with your guidance
```

---

## File Locations

| File | Purpose |
|------|---------|
| `docs/cursor-agents/backlog.md` | Current improvement items |
| `docs/cursor-agents/scores.md` | Current quality scores |
| `docs/cursor-agents/changelog.md` | History of changes |
| `docs/cursor-agents/CHECKLISTS.md` | Manual verification checklists |

---

## Troubleshooting

### Agent Keeps Stopping

**Cause**: Usually missing context or gated items
**Fix**: Check STOP reason, provide needed info or APPROVE

### Scores Dropped

**Cause**: Change introduced regression
**Fix**: Agent should auto-rollback; if not, use changelog rollback notes

### Verification Failing

**Cause**: Change broke something
**Fix**: Agent stops automatically; review DOE section for what changed

### Agent Inventing Features

**Cause**: Should not happen with constraints
**Fix**: Report as bug; agent is forbidden from invention

---

## Best Practices

1. **Start with STATUS** - Always know current state before GO
2. **Use SAFE first** - Let it handle easy wins
3. **Review GATED items** - Don't blindly APPROVE
4. **Check scores after each session** - Ensure quality improved
5. **Commit frequently** - Small, verified changes are safer
6. **Read changelog entries** - Understand what changed and why

---

## Emergency Stop

At any time, type:

```
STOP
```

This immediately halts the autopilot and outputs current state.
