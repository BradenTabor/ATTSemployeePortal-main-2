# Governor backlog

| ID | Cat | Sev | Summary | Status | Deps | Blast | Tier |
|----|-----|-----|---------|--------|------|-------|------|
| BL-001 | QA | HIGH | JobCreationForm: no ref guard — double submit possible | COMPLETE |
| BL-002 | UX | CRITICAL | Dashboard job cards keyboard-accessible (Link + focus ring) | COMPLETE |
| BL-003 | UX | HIGH | Dashboard mobile text min 12px | COMPLETE |
| BL-004 | UX | MEDIUM | Dashboard View all +N more focus-visible ring | COMPLETE | — | 1 | 2 |

## BL-001 (detail)
Category: QA | Severity: HIGH | Source: 14-qa
Summary: JobCreationForm submit uses only setSubmitting(true); no submittingRef. Double-click can fire onSubmit twice.
Evidence: src/components/jobs/JobCreationForm.tsx lines 259-290.
Fix: Add useRef(false) guard, check-and-set at start of handleSubmit, reset in finally.
Blast: 1 file. Effort: M. Tier: 2. Status: COMPLETE
