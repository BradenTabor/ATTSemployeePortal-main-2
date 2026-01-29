# Cursor Autopilot Backlog

Schema: ID | Category | Severity | Summary | Status

Categories: UX | WF | ARCH | PERF | QA | SEC

---

## Backlog Items

| ID | Category | Severity | Summary | Status |
|----|----------|----------|---------|--------|
| BL-001 | PERF | LOW | Lighthouse scores below protocol targets (Perf 86–87%%, A11y 93%%); CI passes but DOE targets Perf ≥90%%, A11y ≥95%% | COMPLETE |
| BL-002 | QA | LOW | npm audit 9 vulnerabilities in dev deps (hono chain); production bundle unaffected; optional upgrade when available | COMPLETE |
| BL-003 | QA | LOW | Add unit test for HistoryEmptyState component (title, description, icon render) | COMPLETE |
| BL-004 | UX | LOW | Audit icon-only interactive elements for missing aria-label; FAB and HistoryEmptyState already compliant | COMPLETE |
| BL-005 | UX | LOW | Add aria-label to EmberExpandableSection toggle (Expand/Collapse title) | COMPLETE |
| BL-006 | UX | LOW | Add aria-label to GoldCollapsibleSection toggle (Expand/Collapse title) | COMPLETE |
| BL-007 | UX | LOW | Add aria-label to mechanic EmberCollapsibleSection toggle (Expand/Collapse title) | COMPLETE |

---

- Security/auth/RLS/schema items require APPROVE even in FULL mode.

- Gated items: none in initial backlog.
| BL-008 | QA | LOW | Add unit test for HistoryErrorState (message, role=alert) | COMPLETE |
| BL-009 | QA | LOW | Add unit test for HistoryPagination (display text, null when empty) | COMPLETE |
| BL-010 | QA | LOW | Add unit test for HistoryPageShell (title, search, filterHint) | COMPLETE |
| BL-011 | QA | LOW | Add unit test for ValidatedSubmitButton (label, loading, errorCount) | COMPLETE |
| BL-012 | QA | LOW | Add unit test for PaginationControls (display text, prev/next) | COMPLETE |
