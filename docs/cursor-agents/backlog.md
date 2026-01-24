# Autopilot Backlog

**Last Updated**: 2026-01-24  
**Total Items**: 47  
**Severity Breakdown**: CRITICAL: 0 | HIGH: 8 | MEDIUM: 25 | LOW: 14

---

## Backlog Items (All)

| ID | Category | Severity | Effort | Status | Priority Score | Summary |
|----|----------|----------|--------|--------|-----------------|---------|
| BL-001 | UX | HIGH | S | COMPLETED | 95 | Disable submit button during validation; show loading state |
| BL-002 | UX | MEDIUM | XS | PENDING | 82 | Add aria-pressed to P/F/N/A buttons for screen readers |
| BL-003 | UX | MEDIUM | S | PENDING | 75 | Fix ValidationSummary positioning on mobile; prevent overlap |
| BL-004 | UX | LOW | XS | PENDING | 45 | Add aria-disabled to disabled Previous button; prevent keyboard activation |
| BL-005 | UX | MEDIUM | S | PENDING | 78 | Differentiate submit section with stronger visual treatment |
| BL-006 | UX | HIGH | S | PENDING | 92 | Pass all field errors to StepJobInfo; show inline error messages |
| BL-007 | UX | LOW | XS | PENDING | 42 | Explain TRAPS/TOOLS acronyms with tooltip or inline expansion |
| BL-008 | UX | MEDIUM | XS | PENDING | 72 | Increase form list spacing on mobile; prevent cramped UI |
| BL-009 | UX | MEDIUM | S | PENDING | 70 | Add visual feedback during long-press detection (250ms indicator) |
| BL-010 | UX | HIGH | M | PENDING | 88 | Improve error message handling; translate technical errors to user-friendly messages |
| BL-011 | UX | MEDIUM | XS | PENDING | 76 | Increase label font size to 12px minimum; improve required asterisk contrast |
| BL-012 | UX | MEDIUM | S | PENDING | 74 | Add "Saving..." indicator during auto-save; ensure debouncing works |
| BL-013 | WF | HIGH | M | PENDING | 90 | Add "Next Error" button to ValidationSummary; navigate between errors |
| BL-014 | WF | MEDIUM | S | PENDING | 68 | Add "Fill from Profile" button to restore auto-populated driver info |
| BL-015 | WF | HIGH | L | GATED | 85 | Persist photos in draft as base64; convert photos for persistence |
| BL-016 | WF | MEDIUM | M | PENDING | 72 | Add error indicators to step buttons; show error count |
| BL-017 | WF | LOW | S | PENDING | 52 | Add "Add 5 Spans" or "Add 10 Spans" quick action button |
| BL-018 | WF | MEDIUM | XS | PENDING | 69 | Add "Mark All Fail" quick action button to DVIR checklist |
| BL-019 | WF | MEDIUM | XS | PENDING | 65 | Update beforeunload message to mention draft recovery option |
| BL-020 | WF | LOW | M | PENDING | 48 | Add drag handle icon to pinned favorites; show mobile hint on first pin |
| BL-021 | ARCH | HIGH | M | PENDING | 86 | Fix type safety in useFormValidation; make hook generic |
| BL-022 | ARCH | MEDIUM | L | PENDING | 77 | Refactor DailyJSAForm component; extract business logic to hooks |
| BL-023 | ARCH | MEDIUM | S | PENDING | 71 | Separate file validation from form state validation in DVIRForm |
| BL-024 | ARCH | LOW | XS | PENDING | 41 | Remove duplicate InputFieldProps interface definition |
| BL-025 | ARCH | MEDIUM | M | PENDING | 79 | Extract submission logic to service layer (jsaService.ts) |
| BL-026 | ARCH | LOW | S | PENDING | 51 | Refactor compliance fetch to use proper loading state pattern |
| BL-027 | ARCH | MEDIUM | M | PENDING | 73 | Group JsaWizard props into logical objects; reduce prop count |
| BL-028 | ARCH | LOW | XS | PENDING | 43 | Extract user initials logic to utility function |
| BL-029 | ARCH | MEDIUM | S | PENDING | 75 | Create centralized error handling utility for form submissions |
| BL-030 | ARCH | LOW | XS | PENDING | 40 | Extract navigation items to shared config file |
| BL-031 | PERF | MEDIUM | S | PENDING | 68 | Optimize form validation useMemo; remove debug logging |
| BL-032 | PERF | LOW | M | PENDING | 55 | Add route preloading strategy for admin routes |
| BL-033 | PERF | MEDIUM | M | PENDING | 76 | Implement React Query for compliance queries; add caching |
| BL-034 | PERF | LOW | S | PENDING | 58 | Optimize PinnedItem memoization; ensure stable props |
| BL-035 | PERF | MEDIUM | S | PENDING | 79 | Debounce previous mileage query (300-500ms delay) |
| BL-036 | PERF | LOW | XS | PENDING | 47 | Optimize lucide-react tree-shaking; ensure only used icons included |
| BL-037 | PERF | MEDIUM | M | PENDING | 74 | Optimize stepCompletionStatus useMemo; split by step |
| BL-038 | PERF | LOW | S | PENDING | 54 | Add database indexes on date columns; improve query performance |
| BL-039 | QA | HIGH | M | GATED | 87 | Add handling for partial success in database operations |
| BL-040 | QA | HIGH | L | GATED | 84 | Handle photo persistence edge cases; add recovery mechanism |
| BL-041 | QA | MEDIUM | S | PENDING | 70 | Improve Unicode surrogate detection; preserve valid emoji |
| BL-042 | QA | HIGH | L | GATED | 89 | Add unit tests for DailyJSAForm submission logic |
| BL-043 | QA | MEDIUM | S | PENDING | 73 | Fix previous mileage query; exclude same-day reports |
| BL-044 | QA | MEDIUM | M | PENDING | 72 | Add retry logic for failed audit log entries; queue in IndexedDB |
| BL-045 | QA | LOW | XS | PENDING | 53 | Improve swipe gesture detection; require horizontal dominance |
| BL-046 | QA | HIGH | L | GATED | 86 | Add unit tests for DVIRForm submission logic |
| BL-047 | QA | LOW | S | PENDING | 64 | Fix DST timezone conversion; use date-fns-tz library |

---

## NEXT ACTION

Autopilot is ready. **Current backlog has 47 items (8 HIGH, 25 MEDIUM, 14 LOW)**.

**GATED items requiring approval**:
- BL-015: Photo persistence (data migration, risk of data loss)
- BL-039: Partial success handling (error handling refactor)
- BL-040: Photo recovery mechanism (user-facing change)
- BL-042: Form submission tests (can run independently)
- BL-046: DVIR submission tests (can run independently)

**Recommended first item (highest ROI)**: BL-001 (Disable submit button, HIGH severity, S effort)

Send `APPROVE: BL-001` to start execution, or `STATUS` to review current state.
