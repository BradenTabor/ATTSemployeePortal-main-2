# Worker Qualifications Section — Revised Plan (post-review)

This document updates the Worker Qualifications UI overhaul plan with explicit decisions on filtering, data loading, grant modal, triage chips, column layout, and mobile scope.

---

## 1. Filtering intersection logic (explicit)

**Decision: client-side intersection with a `Set<user_id>` derived from the matrix.**

- **Worker list** comes from `useWorkerQualifications()` (optionally filtered by electrical level in the existing API). Apply search (name) in the component. Result: `workersFilteredBySearchAndLevel`.
- **Matrix** is loaded once (see §2): `useUserCertificationMatrix()` with no args when certification filter or summary column is used (see below). Result: rows of shape `{ user_id, certification_type_id, certification_name, compliance_status, ... }`.
- **When Certification and/or Compliance filter is set**: Build `allowedUserIds = new Set(matrixRows.map(r => r.user_id))` (if only cert type is set, filter matrix in memory by `certification_type_id` and optionally `compliance_status`; then extract user_ids). Then:
  - `filteredWorkers = workersFilteredBySearchAndLevel.filter(w => allowedUserIds.has(w.user_id))`.
- **Where the join occurs**: In the component, in a `useMemo` that takes `workers`, `matrix`, `certFilter`, `complianceFilter` and returns the filtered list. No new combined backend query.
- **Scale**: For hundreds of workers × several cert types, the matrix is still one materialized-view read; building the Set and filtering the worker list is O(workers + matrix rows). Pagination is applied after this filter, so only 25 rows are rendered.

---

## 2. Matrix always loaded when summary column or cert filter is used

**Decision: Always fetch the full matrix in Worker Qualifications when either (a) the Certification or Compliance filter is active, or (b) the "Internal certs" summary column is shown.** In practice: always fetch the matrix in this section (no conditional). The materialized view is fast; one read gives both:

- **Filtering**: When user selects a cert type (and optionally compliance), filter matrix in memory and derive `allowedUserIds` for the intersection in §1.
- **Summary column**: For each worker in the current page, count rows in the matrix for that `user_id` with status `active` (or compliance_status `compliant`) to show "2/5" or "3 active" without extra queries.

This avoids conditional data availability and keeps a single source of truth for "user × cert type" in this section. If we later need to avoid loading the matrix when no filter and no summary column, we can add a feature flag or lazy load when the user opens the cert filter dropdown; for the first version, always loading is simpler.

---

## 3. Expand behavior and per-row query

**Confirmed: Single expand only.** The component uses `expandedUserId: string | null`; expanding a row sets it to that user’s id, expanding another sets it to the new id (previous row collapses). So at most one row is expanded at a time.

**Implication:** `useWorkerInternalCertRecords(userId)` with `enabled: expandedUserId === userId` runs at most one query at a time. No N-queries concern. The pattern is acceptable.

---

## 4. Grant certification access — purpose-built worker-scoped modal

**Decision: New small modal, worker-scoped, not a reuse of the existing Manage Access modal.**

- **Existing:** [CertificationsManagementSection](src/components/admin/certifications/CertificationsManagementSection.tsx) uses a modal scoped to a **cert type** (choose cert → then see list of users and grant/revoke). [useGrantCertificationAccess](src/hooks/useCertifications.ts) exists and calls `supabase.rpc('grant_certification_access', ...)`.
- **New:** In Worker Qualifications, when the user clicks "Grant certification access" (or "Assign certification") in the expandable row, open a **worker-scoped** modal:
  - Title: e.g. **"Grant certification access — {worker name}"**
  - Body: "Grant access to:" plus a **dropdown of internal cert types** (from `useCertificationTypes()`). Optionally show which cert types this worker already has access to or has earned, so we don’t suggest granting again.
  - Primary action: "Grant access" → call `useGrantCertificationAccess({ userId: expandedUserId, certificationTypeId: selectedCertTypeId })`.
- **Implementation:** New component, e.g. `GrantCertAccessModal.tsx`, that receives `workerId`, `workerName`, `onClose`, and uses `useCertificationTypes()` and `useGrantCertificationAccess()`. No need to reuse the Manage Access modal’s multi-user UI.

---

## 5. Internal certs column vs External certs column — table width

**Decision: Prefer a single combined "Certifications" column** to avoid a wide table (Name, Role, Electrical, Qualification Date, Verified By, External Certs, Internal Certs, Actions).

- **Option A (recommended):** One column **"Certifications"** that shows:
  - Internal: e.g. "3 active" or "2/5" (from matrix counts).
  - External: keep the existing badge (or a short "1 ext" if space is tight).
  - Layout: one cell with two lines or two compact chips (Internal: 3 · External: 1) or stacked badges. Click/expand still opens the row for full detail.
- **Option B:** Keep two columns but make them narrow (e.g. "Int." and "Ext." with counts/badges only). If the design feels cramped, switch to Option A.

The plan commits to **Option A**. Build one column that renders a small sub-component (e.g. `WorkerCertsSummaryCell`) with internal count and external badge props. Splitting into two narrow columns later, if desired, is a minor refactor (same data, different layout).

---

## 6. Triage chips and the broader cert view

**Decision: Explicitly defer triage chip expansion to a follow-up.**

- **Current:** The hub’s triage chips include "X workers unqualified" (electrical only, from `useWorkerQualifications()`).
- **Possible extension:** "X workers with expiring/internal cert issues" using the matrix (e.g. count users with at least one `expiring_soon` or `non_compliant` internal cert). That would require matrix-based counts and possibly new chip(s).
- **Scope:** This plan does **not** change the triage chip logic. We document that triage remains electrical-only for "unqualified"; matrix-based triage (e.g. "X workers with expiring certs") is a separate, deferred improvement so the current work stays focused on the Worker Qualifications section itself.

---

## 7. useGrantCertificationAccess — reference

**Already exists.** Implementations:

- **Hook:** [src/hooks/useCertifications.ts](src/hooks/useCertifications.ts) — `useGrantCertificationAccess()`.
- **Usage:** [CertificationsManagementSection](src/components/admin/certifications/CertificationsManagementSection.tsx) (Manage Access modal), [AdminCertifications](src/pages/admin/AdminCertifications.tsx).

The Worker Qualifications grant flow will use the same hook; only the modal UI is new (worker-scoped, cert type dropdown).

---

## 8. Mobile optimization — scoped and/or deferred

**Decision: Scope tightly for this phase; defer deep polish to a follow-up.**

- **In scope (minimal):**
  - **Breakpoint:** Use existing Tailwind breakpoint for "filters stack / table hidden" (e.g. `sm`, 640px). Filters (search, level, certification, compliance) stack vertically below `sm`; full-width dropdowns where needed.
  - **Cards:** Already present for mobile; ensure expandable content (internal certs list, external card, electrical history) has no horizontal scroll (stack blocks, wrap or scroll only inside tables if needed).
  - **Touch:** Expand/collapse and primary actions (Grant access, + external) have adequate touch target (e.g. min 44px). No new breakpoints beyond what exists.
- **Deferred (polish pass):**
  - Collapsible "Filters" drawer, custom breakpoints, and larger typography/layout refinements. Call out in the implementation todos as "Mobile polish (deferred)."

Estimated effort for in-scope mobile: small (already card-based); full polish as a separate pass.

---

## 9. Implementation order (unchanged, with refs)

1. **Query key + `useWorkerInternalCertRecords(userId)`** — expandable row internal certs list with expiry. Single-expand confirmed.
2. **Always load matrix in Worker Qualifications** — use for cert/compliance filter intersection (§1) and for summary counts. Add Certification (and optional Compliance) filter + URL params.
3. **Combined "Certifications" column** — internal count + external badge in one column (§5).
4. **Grant certification access** — new `GrantCertAccessModal` (worker-scoped), using existing `useGrantCertificationAccess` (§4, §7).
5. **Mobile (minimal)** — stacked filters, no horizontal scroll in expandable, touch targets (§8). Defer deeper polish.
6. **Triage chips** — no change; document as deferred (§6).
7. **Export CSV** — optional: add internal cert summary columns if needed.

---

## 10. Files to touch (updated)

| Area | Files |
|------|--------|
| Hooks / keys | [src/hooks/useCertifications.ts](src/hooks/useCertifications.ts) — add `useWorkerInternalCertRecords`; [src/lib/queryKeys.ts](src/lib/queryKeys.ts) — new key for worker internal records. **Grant hook:** already in useCertifications.ts, no new file. |
| Section UI | [src/components/admin/certifications/WorkerQualificationsSection.tsx](src/components/admin/certifications/WorkerQualificationsSection.tsx) — filters (cert + compliance), intersection logic (§1), matrix load, combined Certifications column, expandable internal certs list, mobile filter stack. |
| New components | `WorkerInternalCertsList.tsx` (expandable block, optional); **`GrantCertAccessModal.tsx`** (worker-scoped grant modal). |
| Hub | [src/pages/admin/CertificationsHub.tsx](src/pages/admin/CertificationsHub.tsx) — ensure refetch on tab focus if needed; **no triage chip changes** in this plan. |

---

This revision keeps the original data flow and implementation order, and locks in: client-side filter intersection, always-on matrix when in this section, single-expand for the per-row query, a dedicated worker-scoped grant modal, a combined certifications column, triage and mobile polish deferred, and a clear reference to the existing grant hook.
