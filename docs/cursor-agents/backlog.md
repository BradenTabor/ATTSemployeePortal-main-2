# Cursor Autopilot Backlog

Schema: ID | Category | Severity | Summary | Status

Categories: UX | WF | ARCH | PERF | QA | SEC | CROSS

---

## Completed (Prior Cycle)

| ID | Cat | Sev | Summary | Status |
|----|-----|-----|---------|--------|
| BL-001 | PERF | LOW | Lighthouse scores below protocol targets | COMPLETE |
| BL-002 | QA | LOW | npm audit 9 vulnerabilities in dev deps | COMPLETE |
| BL-003 | QA | LOW | Add unit test for HistoryEmptyState | COMPLETE |
| BL-004 | UX | LOW | Audit icon-only elements for missing aria-label | COMPLETE |
| BL-005 | UX | LOW | Add aria-label to EmberExpandableSection toggle | COMPLETE |
| BL-006 | UX | LOW | Add aria-label to GoldCollapsibleSection toggle | COMPLETE |
| BL-007 | UX | LOW | Add aria-label to mechanic EmberCollapsibleSection toggle | COMPLETE |
| BL-008 | QA | LOW | Add unit test for HistoryErrorState | COMPLETE |
| BL-009 | QA | LOW | Add unit test for HistoryPagination | COMPLETE |
| BL-010 | QA | LOW | Add unit test for HistoryPageShell | COMPLETE |
| BL-011 | QA | LOW | Add unit test for ValidatedSubmitButton | COMPLETE |
| BL-012 | QA | LOW | Add unit test for PaginationControls | COMPLETE |
| BL-013 | UX | CRITICAL | StepReview.tsx uses `window.confirm()` — blocks UI, poor a11y, inconsistent design | COMPLETE |
| BL-015 | QA | HIGH | App.tsx: No error boundary wrapping Suspense/Routes — lazy load failures crash app | COMPLETE |
| BL-019 | PERF | HIGH | networkStatus.ts: Event listeners never removed in stopNetworkMonitor() — memory leak | COMPLETE |
| BL-020 | WF | HIGH | syncHistory.ts: In-memory Zustand store loses data on refresh — Recently Synced UI broken | COMPLETE |
| BL-021 | UX | HIGH | OfflineQueuePanel.tsx handleDiscard deletes queued items without confirmation — data loss risk | COMPLETE |
| BL-022 | QA | HIGH | OfflineQueuePanel.tsx handleSyncAll has no partial failure handling | COMPLETE |
| BL-024 | UX | HIGH | StepJobInfo.tsx file input missing aria-label — inaccessible to screen readers | COMPLETE |
| BL-025 | UX | HIGH | ComplianceDataExportPanel.tsx error display lacks role="alert" | COMPLETE |
| BL-023 | UX | HIGH | JsaDetailModal.tsx lightbox lacks focus trap and keyboard nav (ESC, arrows) | COMPLETE |
| BL-026 | QA | HIGH | ComplianceDataExportPanel.tsx handleLoad doesn't validate date range before fetch | COMPLETE |
| BL-027 | QA | HIGH | OfflineQueueContext.tsx integrity check only validates one photo field per form type | COMPLETE |
| BL-029 | QA | MEDIUM | JsaWizard.tsx onComplete handler silently swallows errors | COMPLETE |
| BL-030 | QA | MEDIUM | StepJobInfo.tsx error handling swallows exceptions without user feedback | COMPLETE |

---

## Active Backlog

| ID | Cat | Sev | Summary | Status | Deps | Blast | Tier |
|----|-----|-----|---------|--------|------|-------|------|
| BL-014 | ARCH | CRITICAL | DailyEquipmentInspectionForm.tsx is 1723 lines — extract sub-components/hooks | OPEN | — | 5+ | 3 |
| BL-016 | ARCH | HIGH | DailyJSAForm.tsx is 1676 lines — extract sub-components/hooks | OPEN | — | 5+ | 3 |
| BL-017 | ARCH | HIGH | DVIRForm.tsx is 1412 lines — extract sub-components/hooks | OPEN | — | 5+ | 3 |
| BL-018 | ARCH | HIGH | GeneralForemanSafetyCompliance.tsx duplicates AdminJSA patterns (1098 lines) — share components | OPEN | — | 4 | 3 |
| BL-028 | CROSS | MEDIUM | Orphaned photos not cleaned up on queue item delete/conflict (offlineQueue + syncConflicts + OfflineQueueContext). Source: [PERF, WF, QA] | OPEN | — | 3 | 2 |
| BL-031 | SEC | MEDIUM | Home.tsx: No rate limiting on sign-in/sign-up attempts | OPEN | — | 2 | 2 |
| BL-032 | SEC | MEDIUM | AuthContext.tsx: Profile cache (24h TTL) not invalidated on role change — stale permissions | OPEN | — | 2 | 2 |
| BL-033 | SEC | MEDIUM | AdminJSA/GF pages rely on client-side role check — verify RLS policies enforced | OPEN | — | 3 | 2 |
| BL-034 | ARCH | MEDIUM | AuthContext.tsx: Multiple sequential setState calls not batched — extra re-renders | OPEN | — | 1 | 1 |
| BL-035 | ARCH | MEDIUM | useJSASubmission.ts / useJSAFormValidation.ts: Unsafe type assertions weaken type safety | OPEN | — | 2 | 1 |
| BL-036 | PERF | MEDIUM | OfflineQueueContext / useJSAPhotoUpload: Sequential photo uploads — should parallelize | OPEN | — | 2 | 2 |
| BL-037 | PERF | MEDIUM | offlinePhotoStore.ts: No size validation before storing — can exhaust quota silently | OPEN | — | 1 | 2 |
| BL-038 | QA | MEDIUM | queryPersister.ts restoreClient() doesn't check maxAge — may restore stale data | OPEN | — | 1 | 2 |
| BL-039 | WF | MEDIUM | OfflineModeBanner.tsx handleSync has no error feedback on failure | OPEN | — | 1 | 2 |
| BL-040 | QA | MEDIUM | offlineQueue.ts: JSON deep clone fails on non-serializable data (Date, undefined, etc.) | OPEN | — | 1 | 2 |
| BL-041 | QA | MEDIUM | useAdminJSAQuery / GF: Batch profile errors return empty array — partial failures silent | OPEN | — | 2 | 2 |
| BL-042 | QA | MEDIUM | Dashboard.tsx NavigableJobCard uses JSON.stringify for comparison — expensive and fragile | OPEN | — | 1 | 1 |
| BL-043 | UX | MEDIUM | OfflineQueueContext.tsx: No user feedback on conflict detection — silently archived | OPEN | — | 1 | 2 |
| BL-044 | UX | MEDIUM | StepReview.tsx: Shared users list lacks keyboard navigation | OPEN | — | 1 | 2 |
| BL-045 | SEC | MEDIUM | DailyJSAForm.tsx auth check inconsistent with DVIR — doesn't verify session | OPEN | — | 1 | 2 |
| BL-046 | SEC | MEDIUM | sw.ts: Push notification payload not validated — malicious payloads possible | OPEN | — | 1 | 2 |
| BL-047 | PERF | MEDIUM | DVIRForm.tsx: Previous mileage fetch on every truck number change — no debounce | OPEN | — | 1 | 2 |
| BL-048 | QA | MEDIUM | Announcements.tsx: Side effect in render (search reset) — should be in useEffect | OPEN | — | 1 | 1 |
| BL-049 | PERF | MEDIUM | App.tsx AnimatePresence wrapping all routes — performance impact | OPEN | — | 1 | 2 |
| BL-050 | QA | MEDIUM | useStorageQuota.ts: No error handling for storage API failures | OPEN | — | 1 | 1 |
| BL-051 | UX | LOW | JsaWizard.tsx validation error display lacks role="alert" container | OPEN | — | 1 | 1 |
| BL-052 | UX | LOW | OfflineFormIndicator.tsx: No loading state during network status determination | OPEN | — | 1 | 1 |
| BL-053 | UX | LOW | RecentlySynced.tsx: formatSyncTime duplicates logic from OfflineModeBanner | OPEN | — | 2 | 1 |
| BL-054 | PERF | LOW | syncConflicts.ts: Expired conflicts filtered in memory instead of using IDB index | OPEN | — | 1 | 1 |
| BL-055 | PERF | LOW | offlinePhotoStore.ts: getStorageUsage() loads all photos into memory | OPEN | — | 1 | 1 |
| BL-056 | QA | LOW | sw.ts: Notification click handler doesn't catch errors from focus()/openWindow() | OPEN | — | 1 | 1 |
| BL-057 | PERF | LOW | App.tsx: preloadCriticalChunks doesn't check if already loaded | OPEN | — | 1 | 1 |
| BL-058 | SEC | LOW | sw.ts: Notification URL not validated as same-origin | OPEN | — | 1 | 1 |

---

- Security/auth/RLS/schema items require APPROVE even in FULL mode.
- Cross-cutting items (BL-028) owned by highest-priority specialist.
