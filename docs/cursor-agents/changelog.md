# Cursor Autopilot Changelog

Entries: BACKLOG-ID | Date | Summary | Files | Verification | Scores | Rollback

---

## Entries

(No entries yet.)

[BL-003] | 2026-01-29 | Add unit test for HistoryEmptyState (title, description, icon). IntersectionObserver mock in vitest.setup.ts for BlurFade/useInView.
Files: tests/unit/components/HistoryEmptyState.test.tsx, vitest.setup.ts
Verification: Unit tests PASS (327 passed). TypeScript/Lint/Build not run (timeout in env).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- tests/unit/components/HistoryEmptyState.test.tsx vitest.setup.ts

[BL-004] | 2026-01-29 | Add aria-label to CollapsibleSection toggle (Expand/Collapse title) for screen readers.
Files: src/components/dashboard/CollapsibleSection.tsx
Verification: Unit tests PASS (327 passed). Lint clean.
Scores: 88 → 88 (no regression).
Rollback: git checkout -- src/components/dashboard/CollapsibleSection.tsx

[BL-001] | 2026-01-29 | Document DOE protocol targets in lighthouserc.cjs (perf ≥0.9, a11y ≥0.95) as improvement goal.
Files: lighthouserc.cjs
Verification: Unit tests PASS (327 passed). No CI behavior change.
Scores: 90 → 90 (no regression).
Rollback: git checkout -- lighthouserc.cjs

[BL-002] | 2026-01-29 | Document dev-only npm audit policy in DependenciesAndSecurity.md (hono chain, optional upgrade when available).
Files: docs/DependenciesAndSecurity.md
Verification: Unit tests PASS (327 passed).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- docs/DependenciesAndSecurity.md

[BL-005, BL-006, BL-007] | 2026-01-29 | Add aria-label to expandable section toggles (EmberExpandableSection, GoldCollapsibleSection, mechanic EmberCollapsibleSection).
Files: src/components/dashboard/EmberExpandableSection.tsx, src/components/admin/GoldCollapsibleSection.tsx, src/components/mechanic/EmberCollapsibleSection.tsx
Verification: Unit tests PASS (327 passed). Lint clean.
Scores: 88 → 88 (no regression).
Rollback: git checkout -- src/components/dashboard/EmberExpandableSection.tsx src/components/admin/GoldCollapsibleSection.tsx src/components/mechanic/EmberCollapsibleSection.tsx

[BL-008] | 2026-01-29 | Add unit test for HistoryErrorState (message, role=alert).
Files: tests/unit/components/HistoryErrorState.test.tsx
Verification: Unit tests PASS (330 passed).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- tests/unit/components/HistoryErrorState.test.tsx

[BL-009] | 2026-01-29 | Add unit test for HistoryPagination (display text, null when empty).
Files: tests/unit/components/HistoryPagination.test.tsx
Verification: Unit tests PASS (333 passed).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- tests/unit/components/HistoryPagination.test.tsx

[BL-010] | 2026-01-29 | Add unit test for HistoryPageShell (title, search, filterHint).
Files: tests/unit/components/HistoryPageShell.test.tsx
Verification: Unit tests PASS (336 passed).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- tests/unit/components/HistoryPageShell.test.tsx

[BL-011] | 2026-01-29 | Add unit test for ValidatedSubmitButton (label, loading, errorCount).
Files: tests/unit/components/ValidatedSubmitButton.test.tsx
Verification: Unit tests PASS (341 passed).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- tests/unit/components/ValidatedSubmitButton.test.tsx

[BL-012] | 2026-01-29 | Add unit test for PaginationControls (display text, prev/next).
Files: tests/unit/components/PaginationControls.test.tsx
Verification: Unit tests PASS (346 passed).
Scores: 90 → 90 (no regression).
Rollback: git checkout -- tests/unit/components/PaginationControls.test.tsx
