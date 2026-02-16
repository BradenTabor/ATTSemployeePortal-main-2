# Cursor Autopilot Scores

Scores re-established from full REAUDIT on 2026-02-15. All scores 0–100.

---

## Current Scores

| Metric | Score | Delta | Evidence |
|--------|-------|-------|----------|
| UX Clarity | 78 | 88→78 | window.confirm() in StepReview (BL-013); lightbox missing focus trap (BL-023); file input missing aria-label (BL-024); error displays missing role="alert" (BL-025, BL-051); no discard confirmation (BL-021); no conflict feedback (BL-043). Positives: loading states in 52+ files; aria-labels on expandable sections; empty states; focus-visible widespread. |
| Workflow Efficiency | 77 | 85→77 | syncHistory in-memory only — lost on refresh (BL-020); orphaned photo cleanup missing (BL-028); no sync error feedback (BL-039); no conflict user notification (BL-043). Positives: full offline queue system built; draft recovery; JSA wizard with progress; history pagination. |
| Correctness/Determinism | 72 | 90→72 | No error boundary around Suspense/Routes (BL-015); 3 form components >1400 lines (BL-014,016,017); silent error swallowing in JsaWizard/StepJobInfo (BL-029,030); partial failure handling missing (BL-022,041); JSON deep clone fragile (BL-040); query persister restores stale data (BL-038); auth check inconsistency (BL-045). Positives: TypeScript strict; Zod validation; unit + e2e suites. |

---

## UX Subscore Breakdown

| Subscore | Score | Notes |
|----------|-------|-------|
| A) Visual Hierarchy | 85 | Primary/secondary CTAs consistent; good typography scale |
| B) Layout Architecture | 82 | Consistent shells; large component sizes reduce maintainability |
| C) Interaction States | 78 | Loading/disabled/focus-visible present; window.confirm breaks pattern |
| D) Feedback Quality | 72 | Silent error swallowing; no conflict notification; sync errors silent |
| E) Form UX | 80 | Labels/validation present; photo input missing aria-label; no upload progress |
| F) Accessibility | 75 | Missing focus trap in lightbox; file input a11y gap; missing role="alert" |
| G) Responsive/Mobile | 85 | Good mobile layouts; offline indicators present |
| H) Microcopy | 82 | Clear empty state copy; some error messages too generic |

---

## Performance (informational — no dedicated score per governor schema)

| Signal | Status |
|--------|--------|
| Memory leaks | networkStatus event listeners not cleaned up (BL-019) |
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

Last Updated: 2026-02-15 (REAUDIT)
