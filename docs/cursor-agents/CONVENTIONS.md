# Shared State Convention

## Ownership Rules
1. **Single writer**: Each file has one owner. Only the owner writes.
2. **All read**: Any specialist or the governor may read any file.
3. **Governor is arbiter**: Ownership disputes resolved by governor.
4. **Human-owned files**: `critical-paths.md` is human-maintained. Agents read, never write.

## File Ownership
| File | Owner |
|------|-------|
| backlog.md | Governor |
| scores.md | Governor |
| changelog.md | Governor |
| dependency-graph.md | Governor |
| project-config.md | Governor |
| metrics.md | Governor |
| audit-summary.md | Governor |
| backlog-archive.md | Governor |
| critical-paths.md | **Human** |
| CONVENTIONS.md | **Human** |
| shared/flow-registry.md | QA Specialist |
