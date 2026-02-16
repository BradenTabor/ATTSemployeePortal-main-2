# Cursor Autopilot Scores

Scores re-established from full REAUDIT on 2026-02-15. All scores 0–100.

---

## Current Scores

| Metric | Score | Delta | Evidence |
|--------|-------|-------|----------|
| UX Clarity | 85 | 84→85 | BL-023 resolved (JsaDetailModal photo lightbox focus trap, ESC, arrows). Remaining: role="alert" (BL-051); no conflict feedback (BL-043). Positives: loading states; aria-labels; StepJobInfo photo input a11y; ComplianceDataExportPanel error alert; JsaDetailModal lightbox a11y; empty states; focus-visible; StepReview + OfflineQueuePanel confirm dialogs. |
| Workflow Efficiency | 79 | 77→79 | BL-020 resolved (sync history persisted to localStorage). Remaining: orphaned photo cleanup (BL-028); no sync error feedback (BL-039); no conflict user notification (BL-043). Positives: full offline queue; draft recovery; JSA wizard; history pagination; Recently Synced survives refresh. |
| Correctness/Determinism | 77 | 76→77 | BL-027 resolved (OfflineQueueContext integrity check all photo fields). Remaining: 3 form components >1400 lines (BL-014,016,017); silent error swallowing (BL-029,030); partial failure (BL-041); JSON deep clone (BL-040); query persister (BL-038); auth check (BL-045). Positives: TypeScript strict; Zod; unit + e2e; route-level error boundary; export date validation; offline integrity checks. |

---

## UX Subscore Breakdown

| Subscore | Score | Notes |
|----------|-------|-------|
| A) Visual Hierarchy | 85 | Primary/secondary CTAs consistent; good typography scale |
| B) Layout Architecture | 82 | Consistent shells; large component sizes reduce maintainability |
| C) Interaction States | 80 | Loading/disabled/focus-visible present; StepReview confirm dialog consistent (BL-013 fixed) |
| D) Feedback Quality | 72 | Silent error swallowing; no conflict notification; sync errors silent |
| E) Form UX | 82 | Labels/validation present; StepJobInfo photo input aria-label (BL-024); no upload progress |
| F) Accessibility | 80 | JsaDetailModal lightbox focus trap + ESC + arrows (BL-023); StepJobInfo file input a11y (BL-024); ComplianceDataExportPanel error alert (BL-025); remaining role="alert" (BL-051) |
| G) Responsive/Mobile | 85 | Good mobile layouts; offline indicators present |
| H) Microcopy | 82 | Clear empty state copy; some error messages too generic |

---

## Performance (informational — no dedicated score per governor schema)

| Signal | Status |
|--------|--------|
| Memory leaks | Resolved — stopNetworkMonitor() removes listeners (BL-019) |
| Bundle splitting | Good — manual chunks in vite config |
| Photo uploads | Sequential, not parallelized (BL-036) |
| Storage management | No quota check before writes (BL-037) |
| Render efficiency | AnimatePresence wrapping all routes (BL-049); JSON.stringify comparison (BL-042) |

---

## Security (informational — no dedicated score per governor schema)

| Signal | Status |
|--------|--------|
| Auth checks | Inconsistent between JSA and DVIR (BL-045) |
| Rate limiting | None on auth endpoints (BL-031) |
| Role caching | 24h TTL without invalidation (BL-032) |
| RLS enforcement | Client-side checks present; RLS verification needed (BL-033) |
| SW validation | Push payloads not validated (BL-046) |

---

Last Updated: 2026-02-16 (BL-027)
