# GO Commands Reference

> Copy-paste commands to control the Cursor Autopilot

---

## Mode Control Commands

### Start SAFE Autopilot

Audits and auto-executes LOW/MEDIUM severity items. Stops for HIGH/CRITICAL and security.

```
GO: AUTOPILOT SAFE
```

---

### Start FULL Autopilot

Audits and can execute any severity with explicit approval.

```
GO: AUTOPILOT FULL
```

---

### Emergency Stop

Immediately halt all execution. Output current state.

```
STOP
```

---

## Item Control Commands

### Approve Gated Item

Authorize a specific backlog item for execution.

```
APPROVE: BL-001
```

Replace `BL-001` with the actual backlog ID.

---

### Execute Specific Item

Skip queue priority, execute immediately.

```
EXECUTE: BL-001
```

Replace `BL-001` with the actual backlog ID.

---

### Check Status

Output current backlog, scores, and recommended next action.

```
STATUS
```

---

## Compound Commands

### Audit Only (No Execution)

Run full specialist audit without executing anything.

```
STATUS
```

(Default mode is READ-ONLY AUDIT)

---

### Approve Multiple Items

Approve several items at once:

```
APPROVE: BL-001
APPROVE: BL-002
APPROVE: BL-003
```

---

### Switch Modes Mid-Session

Stop current mode and switch:

```
STOP
GO: AUTOPILOT FULL
```

---

## Quick Reference Card

| Command | Effect |
|---------|--------|
| `GO: AUTOPILOT SAFE` | Start safe auto-execution |
| `GO: AUTOPILOT FULL` | Start full auto-execution |
| `STOP` | Halt immediately |
| `APPROVE: <ID>` | Authorize gated item |
| `EXECUTE: <ID>` | Execute specific item now |
| `STATUS` | Show current state |

---

## Command Patterns

### Morning Routine

```
STATUS
GO: AUTOPILOT SAFE
```

### End of Day Review

```
STOP
STATUS
```

### Security Review Session

```
STATUS
APPROVE: SEC-001
APPROVE: SEC-002
GO: AUTOPILOT FULL
```

### Quick Fix

```
EXECUTE: BL-042
```

---

## Notes

- Commands are case-sensitive
- One command per line
- Wait for agent response before next command
- `STOP` works at any time
- After `STOP`, state is preserved
