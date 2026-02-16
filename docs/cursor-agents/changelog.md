# Cursor Autopilot Changelog

Entries: BACKLOG-ID | Date | Summary | Files | Verification | Scores | Rollback

---

## Entries

[BL-026] | 2026-02-16 | ComplianceDataExportPanel ExportSection: validate date range before fetch (both dates required, From <= To); set error and return without calling fetchData when invalid.
Files: src/components/admin/ComplianceDataExportPanel.tsx
Verification: TypeScript PASS, Lint PASS. Tier 2.
Scores: Correctness — BL-026 resolved (date validation).
Rollback: git revert a913b10 --no-edit

[BL-023] | 2026-02-16 | JsaDetailModal photo lightbox: focus trap (Tab), ESC to close, Arrow Left/Right to cycle photos; role=dialog, restore focus on close.
Files: src/components/history/JsaDetailModal.tsx
Verification: TypeScript PASS, Lint PASS. Tier 2.
Scores: UX — BL-023 resolved (lightbox a11y).
Rollback: git revert 70193ab --no-edit

[BL-025] | 2026-02-16 | ComplianceDataExportPanel.tsx: add role="alert" to error display for screen reader announcement.
Files: src/components/admin/ComplianceDataExportPanel.tsx
Verification: TypeScript PASS, Lint PASS. Tier 1.
Scores: UX — BL-025 resolved (error role=alert).
Rollback: git revert 087d140 --no-edit

[BL-024] | 2026-02-16 | StepJobInfo.tsx: add aria-label to photo file input for screen readers.
Files: src/components/forms/jsa-steps/StepJobInfo.tsx
Verification: TypeScript PASS, Lint PASS. Tier 1.
Scores: UX — BL-024 resolved (file input a11y).
Rollback: git revert 4b357e0 --no-edit

[BL-022] | 2026-02-16 | OfflineQueuePanel handleSyncAll: capture sync result, show inline partial-failure/success (role=alert/status); hook shows toast for single-item failure and includes discarded in summary.
Files: src/components/OfflineQueuePanel.tsx, src/hooks/useOfflineQueue.ts
Verification: TypeScript PASS, Lint PASS, Unit tests PASS (1 pre-existing DVIR timeout).
Scores: Correctness — BL-022 resolved (partial failure handling).
Rollback: git revert 4c51d61 --no-edit

[BL-021] | 2026-02-16 | Add confirmation dialog before discarding queue items in OfflineQueuePanel (role=alertdialog, focus, Escape).
Files: src/components/OfflineQueuePanel.tsx
Verification: Lint PASS, Unit tests PASS (OfflineQueuePanel 12).
Scores: UX 80→82 (BL-021 resolved).
Rollback: git revert 5072a1f --no-edit

[BL-020] | 2026-02-16 | Persist sync history to localStorage (rehydrate on load, subscribe to persist on change) so Recently Synced survives refresh.
Files: src/lib/syncHistory.ts
Verification: Lint PASS, Unit tests PASS (syncHistory 19, RecentlySynced 5).
Scores: Workflow 77→79 (BL-020 resolved).
Rollback: git revert 0069752 --no-edit

[BL-019] | 2026-02-16 | Remove online/offline/visibilitychange listeners in stopNetworkMonitor() to fix memory leak; store handler refs for add/remove.
Files: src/lib/networkStatus.ts
Verification: Lint PASS, Unit tests PASS (networkStatus 13/13).
Scores: Performance signal — memory leak resolved.
Rollback: git revert 0cfd46d --no-edit

[BL-015] | 2026-02-16 | Wrap Suspense/Routes in AppErrorBoundary so lazy-load and render failures show Try Again instead of crashing app.
Files: src/App.tsx
Verification: TypeScript PASS, Lint PASS, Unit tests PASS (564 passed).
Scores: Correctness 72→74 (BL-015 resolved).
Rollback: git revert 03e2f45 --no-edit

[BL-013] | 2026-02-16 | Replace window.confirm with accessible confirm dialog in StepReview (role=alertdialog, focus, Escape).
Files: src/components/forms/jsa-steps/StepReview.tsx
Verification: TypeScript PASS, Lint PASS, Unit tests PASS (564 passed).
Scores: UX 78→80 (BL-013 resolved).
Rollback: git revert 81f7e3d --no-edit

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
