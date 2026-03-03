# Dependency Graph

## Dependencies

| Item | Depends On | Blocks |
|------|-----------|--------|
| BL-001 | — | — |
| BL-002 | — | — |
| BL-003 | — | — |
| BL-004 | — | — |
| BL-005 | — | — |
| BL-006 | — | BL-011 |
| BL-007 | — | — |
| BL-008 | — | — |
| BL-009 | — | — |
| BL-010 | — | — |
| BL-011 | BL-006 | — |
| BL-012 | — | — |
| BL-013 | — | BL-021 |
| BL-014 | — | — |
| BL-015 | — | — |
| BL-016 | — | — |
| BL-017 | — | — |
| BL-018 | — | — |
| BL-019 | — | — |
| BL-020 | — | — |
| BL-021 | BL-013 | — |

## Notes
- BL-011 (hooks-from-pages circular dep) blocked by BL-006 (JSAForm refactor) — shared types need extraction first
- BL-021 (integration test quality) dependent on BL-013 (integration test gap) being addressed first
- No circular dependencies detected in graph
