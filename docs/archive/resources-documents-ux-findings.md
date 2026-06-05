# UX Findings: Resources & Documents and Subpages

**Audited**: Resources hub, ResourceDocView, CertificationTest, PracticalEvaluation, CertificationCard, TestQuestion, TestProgress, TestResults, CertificationResultOverlay, trainingIndex, safetyIndex, DashboardLayout (as shell), ReturnButton (as nav)  
**Timestamp**: 2026-01-24  
**Findings**: 18

---

## Strategy & Reflection (Your Questions → Audit Mapping)

### UX Strategy (Q1–20)

- **User needs & goals (Q1, Q10, Q17)**: Resources prioritizes Certifications → Training → Safety. Study guides map to certs. Gaps: no in-test "Back to Resources" (only ReturnButton → Dashboard); "Start fresh" confirm is lightweight (**UX-006**).
- **Accessibility & inclusive design (Q4)**: **UX-001–005, UX-010, UX-011**.
- **Errors & unexpected behavior (Q8)**: **UX-007, UX-008, UX-009**.
- **User journey & flow (Q13)**: **UX-012, UX-013**.
- **Usability vs. aesthetics (Q19)**: Good balance; issues are mostly usability.
- **Useful & delightful (Q20)**: Result overlay adds delight; **UX-010, UX-011** would make it safer and more inclusive.

### Information Architecture (Q1–20)

- **Intuitive organization (Q1)**: Three sections (Certs, Training, Safety). **UX-014**: "Documents" in title underused.
- **Hierarchy (Q2)**: Clear. **UX-016**: heading scale inconsistencies.
- **Multi-device (Q6)**: **UX-002, UX-003**.
- **Consistent labeling (Q10)**: **UX-015, UX-016**.
- **Search & discovery (Q17)**: No search; **UX-014** touches discoverability.

### Typography (Q1–20)

- **Hierarchy (Q3)**: **UX-016**.
- **Contrast (Q10)**: **UX-001**.
- **Web typography (Q7)**: Prose in doc viewer is appropriate.

### UI Design (Q1–20)

- **Intuitive interface (Q1)**: **UX-012, UX-013**.
- **Consistency (Q3)**: **UX-015, UX-016**.
- **Accessibility (Q6)**: **UX-001–005, UX-010, UX-011**.
- **Animation (Q7)**: **UX-011** (reduced motion).
- **Responsive (Q8)**: **UX-002, UX-003**.
- **Iconography (Q17)**: **UX-004** (decorative icons).

---

## Findings (Abbreviated)

| ID | Subcategory | Severity | File(s) | Summary |
|----|-------------|----------|---------|---------|
| UX-001 | Accessibility | MEDIUM | Resources, DocView, TestResults | `text-gray-400`/`500`, prose grays may fail WCAG AA on gradient |
| UX-002 | Accessibility | MEDIUM | Resources, CertificationCard, CertificationTest, PracticalEvaluation | Buttons/links < 44px touch targets |
| UX-003 | Responsive | LOW | PracticalEvaluation | Checklist cramped on small screens |
| UX-004 | Accessibility | MEDIUM | Resources, CertificationCard, DocView | Decorative icons missing `aria-hidden` |
| UX-005 | Accessibility | MEDIUM | Resources, DocView, CertificationTest, TestResults | Links/buttons missing `focus-visible` ring |
| UX-006 | Interaction States | MEDIUM | CertificationTest | "Start fresh" vs "Cancel" not distinct (destructive styling) |
| UX-007 | Microcopy | LOW | Resources | Empty certs: "Run migrations…" is dev-facing |
| UX-008 | User Feedback | MEDIUM | CertificationTest | Auto-save fails silently; no success/failure feedback |
| UX-009 | User Feedback | LOW | ResourceDocView | 404 states lack next-step copy |
| UX-010 | Accessibility | **HIGH** | CertificationResultOverlay | Modal lacks role, aria-modal, focus trap, Escape, aria-label on close |
| UX-011 | Motion | MEDIUM | CertificationResultOverlay | `animate-ping` without `prefers-reduced-motion` check |
| UX-012 | Navigation | MEDIUM | DocView, CertificationTest, TestResults | No "Back to Resources" from test start/question flow |
| UX-013 | Navigation | LOW | TestResults | Failed state: no "View study guide" secondary action |
| UX-014 | Microcopy / IA | LOW | Resources, DashboardLayout | "Resources & Documents" vs section labels |
| UX-015 | Design System | LOW | Resources, CertificationCard | Duplicated card pattern; no shared ResourceCard |
| UX-016 | Design System | LOW | Resources, DocView, CertificationTest, TestResults | Inconsistent heading scale (text-base vs text-lg) |
| UX-017 | Form UX | LOW | PracticalEvaluation | Pass/Fail radios could use fieldset/legend or aria-label |
| UX-018 | Layout | LOW | CertificationTest | "X questions · Y% to pass" easily missed; not grouped with Start CTA |

---

## Detailed Findings (Full Schema)

### UX-010 (HIGH) — CertificationResultOverlay modal a11y

**Subcategory**: Accessibility · **File**: `src/components/certifications/CertificationResultOverlay.tsx`

**Observed**: Overlay is a custom modal with backdrop and close button. No `role="dialog"`, `aria-modal="true"`, `aria-labelledby`/`aria-describedby`, or focus trap. Dismiss via backdrop click or "Dismiss"; no Escape. Close (X) has no `aria-label`.

**Evidence**: `<div className="fixed inset-0 z-[9999]…">`, backdrop `onClick={handleDismiss}`, `<button …><X /></button>` with no `aria-label`.

**Impact**: Screen reader users may not recognize it as a modal or how to close it. Keyboard users cannot dismiss with Escape or confine focus to the modal.

**Recommendation**: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (heading), `aria-describedby` (score/message). Trap focus, restore on close. `onKeyDown` Escape → `handleDismiss`. `aria-label="Close"` on X.

**DoD**: Modal has focus trap, Escape closes it, ARIA set, close labeled. Verified with keyboard + screen reader.

**Effort**: M · **Dependencies**: none

---

### UX-001 (MEDIUM) — Contrast (gray text on gradient)

**Subcategory**: Accessibility · **Files**: `Resources.tsx`, `ResourceDocView.tsx`, `TestResults.tsx`

**Observed**: `text-gray-400`, `text-gray-500` and prose `text-gray-300` on DashboardLayout dark gradient. Contrast may fail WCAG AA (4.5:1).

**Evidence**: `className="… text-gray-400"`, `prose-p:text-gray-300 prose-li:text-gray-300`.

**Impact**: Low vision or bright ambient light users may struggle to read descriptions and body text.

**Recommendation**: Use `text-accessible-muted` or equivalent meeting 4.5:1 on gradient; verify prose grays. Run axe/Lighthouse.

**DoD**: Secondary text uses WCAG AA–compliant muted token; no new contrast failures.

**Effort**: M · **Dependencies**: none

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 8 |
| LOW | 9 |

**Priority**: UX-010 → UX-001 → UX-005 → UX-008 → UX-002 → UX-004 → UX-006 → UX-011 → UX-012 → UX-013 → rest.

---

## Implemented (GO: AUTOPILOT FULL)

**2026-01-24** — UX upgrades applied per audit:

| Finding | Status | Changes |
|--------|--------|---------|
| UX-010 | ✅ Done | `CertificationResultOverlay`: role="dialog", aria-modal, aria-labelledby/describedby, focus trap, Escape, aria-label on close |
| UX-011 | ✅ Done | Overlay: `prefersReducedMotion` → skip `animate-ping`; `getDeviceCapabilities` from mobilePerf |
| UX-005 | ✅ Done | focus-visible ring on Resources, DocView, CertificationTest, TestResults, CertificationCard, PracticalEvaluation |
| UX-008 | ✅ Done | Auto-save: "Saving…" / "Saved" inline; toast on failure |
| UX-002 | ✅ Done | min-h-[44px] on primary/secondary buttons and card links |
| UX-004 | ✅ Done | aria-hidden on decorative icons (Award, FileText, Shield, ChevronRight, etc.) |
| UX-006 | ✅ Done | Start fresh: destructive red styling; Cancel secondary; "This cannot be undone" |
| UX-007 | ✅ Done | Empty certs: user-facing copy; no "migrations" mention |
| UX-009 | ✅ Done | DocView 404: next-step copy + "Back to Resources" |
| UX-012 | ✅ Done | "Back to Resources" on cert test start screen |
| UX-013 | ✅ Done | TestResults failed: "View study guides" secondary CTA |
| UX-018 | ✅ Done | "X questions · Y% to pass" moved into start block |

**Not done**: UX-001 (contrast token), UX-003 (PracticalEvaluation responsive), UX-014 (title/sections), UX-015 (ResourceCard), UX-016 (heading scale), UX-017 (fieldset/legend).

---

*Audit per UX Specialist Schema v2.0. Implementations via GO: AUTOPILOT FULL.*
