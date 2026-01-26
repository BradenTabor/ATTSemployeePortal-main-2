# Admin Certification Management UX and Per-Cert Access Control (Revised)

Revised plan incorporating data-model safeguards, indexes, testing, edge cases, and UX details.

---

## 1. Data model and backend

### 1.1 Table: `certification_access_grants`

- **Columns**
  - `id` UUID PK default gen_random_uuid()
  - `user_id` UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
  - `certification_type_id` UUID NOT NULL REFERENCES public.certification_types(id) ON DELETE CASCADE
  - `granted_by` UUID REFERENCES auth.users(id) ON DELETE SET NULL  — preserves audit; null if admin deleted
  - `granted_at` TIMESTAMPTZ NOT NULL DEFAULT now()
  - UNIQUE(user_id, certification_type_id)
- **Audit for revocations (V1 optional)**
  - Option A: Keep grants as insert/delete only; "revocation" = delete row. No revoked_at/revoked_by unless we add a separate audit log.
  - Option B: Add `revoked_at TIMESTAMPTZ`, `revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL` and treat "active" as revoked_at IS NULL. Then revoke = UPDATE instead of DELETE. Single table audit trail.
  - **Recommendation for V1**: Option A (delete = revoke); add a small `certification_access_audit_log` table in a follow-up (who granted/revoked, when) if needed. Otherwise keep schema simple.

### 1.2 Indexes (required for RLS performance)

```sql
CREATE INDEX idx_cert_access_grants_cert_id
  ON public.certification_access_grants(certification_type_id);

CREATE INDEX idx_cert_access_grants_user_cert
  ON public.certification_access_grants(user_id, certification_type_id);
```

### 1.3 Access rule and edge case

- **Rule**: For a cert, if **no** rows exist in `certification_access_grants` → everyone (authenticated) can access. If **at least one** row exists → only grantees + admins.
- **Last grant revoked**: Deleting the last row **immediately** opens the cert to everyone. To make this predictable:
  - **Option A**: Add `is_restricted` BOOLEAN on `certification_types` (default false). When true, enforce grant check; when false, ignore grants. Admin toggles "Restrict access" in UI; adding the first grant could set is_restricted = true, revoking the last could set is_restricted = false (or leave it true so cert stays restricted until admin flips it).
  - **Option B (V1)**: No flag; keep "no rows = open." In admin UI: when revoking the last grant, show a confirmation: "This will make [Cert] accessible to everyone again. Continue?"
- **Recommendation**: V1 use Option B + confirmation modal. Add `is_restricted` in a follow-up if admins want explicit control without relying on row count.

### 1.4 RLS for `certification_types`

- **SELECT (non-admin)**: `is_active = true` AND (no grants for this cert OR user has grant). Use helper so policy stays readable.
- **Helper function**: `user_has_certification_access(p_user_id UUID, p_certification_type_id UUID) RETURNS BOOLEAN` — true if no grants for cert, or user has grant, or user is admin. Use in RLS and RPCs.
- Indexes above keep "exists grant for cert" and "user has grant" checks fast.

### 1.5 RPC enforcement

- **RPCs to update**: `create_certification_attempt`, `get_certification_test_questions`, `can_start_certification_attempt`. Scan all certification-related RPCs (e.g. `submit_certification_test`, `abandon_certification_attempt`, practical eval RPCs that take cert id) and add the same access check where they expose or mutate cert-scoped data.
- **Error messages**: Use a consistent, frontend-friendly pattern, e.g. return or raise with code `CERTIFICATION_ACCESS_DENIED` and a clear message so the app can show: "You don't have access to this certification. Contact an administrator." Avoid exposing internal details.

### 1.6 Migration strategy

- **Rollback**: Provide a down migration that drops the new policy on `certification_types`, drops `certification_access_grants` table and indexes, and restores the original cert_types SELECT policy. If grants exist at rollback time, they are dropped with the table.
- **Initial state**: No grants seeded; all certs remain "open" (current behavior) until an admin adds at least one grant for a cert.

---

## 2. Study guide mapping and filtering

- **TrainingEntry**: Add optional `certificationSlug?: string` in [trainingIndex.ts](src/content/trainingIndex.ts) for each cert-specific guide (e.g. bucket-trimmer-guide → bucket-trimmer). V1: one study guide per cert; `certificationSlug` is a single string.
- **Fragility**: Slug typos or cert slug changes can break the link silently.
  - **Recommendation**: Add a validation test (e.g. in vitest) that (a) loads certification types (or a fixture of slugs) and (b) asserts every `certificationSlug` in TRAINING_ENTRIES exists in that set. Run in CI.
  - **Alternative (follow-up)**: Add `study_guide_slug` (or similar) on `certification_types` for single source of truth and derive training visibility from DB.
- **Resources.tsx**: Filter training list by allowed cert slugs. **Memoize** to avoid repeated work:
  - `allowedSlugs = useMemo(() => new Set(certificationTypes?.map(c => c.slug) ?? []), [certificationTypes])`
  - `visibleTraining = useMemo(() => TRAINING_ENTRIES.filter(e => !e.certificationSlug || allowedSlugs.has(e.certificationSlug)), [allowedSlugs])`
- **ResourceDocView**: For `section === 'training'`, if entry has `certificationSlug`, ensure user has access (same allowed-slugs set). Otherwise show "You don't have access to this study guide" + link to Resources. Safety stays public.

---

## 3. Admin Certification Management page UX

- Same as original plan: section headers with logo, gradient titles, cards, spacing, loading/error/empty, 44px touch targets, focus-visible, aria-hidden.
- **Restriction status**: On each cert card, show a small badge or icon indicating **"Open"** (no grants) vs **"Restricted"** (at least one grant). Helps admins see which certs are access-controlled before opening the modal.
- **Mobile/responsive**: Admin "Manage access" modal and user picker must be usable on small screens (stack layout, scrollable lists, touch-friendly targets).

---

## 4. Admin UI: grant/revoke access

- **Manage access** modal per cert (V1). Optional follow-up: matrix view (certs × users) for bulk management.
- **User picker**: Ensure [useUsersQuery](src/hooks/queries/useUsersQuery.ts) supports search/filtering (it has `options?.search`). Consider showing user role (or department if available) in the list to help admins pick the right person.
- **Revoke last grant**: Show confirmation: "This will make [Cert Name] accessible to everyone again. Continue?"
- **After grant/revoke**: Invalidate certification queries so RLS and UI reflect changes immediately. RLS reads current DB state, not session cache, so the next request sees the new permissions.

---

## 5. Testing checklist

- **RLS**
  - Non-admin sees only granted certs when at least one grant exists for a cert.
  - Non-admin sees all active certs when no grants exist for any cert.
- **RPC**
  - `create_certification_attempt` rejects with clear error when user does not have access.
  - `get_certification_test_questions` (and any other cert-scoped RPC) rejects when user does not have access.
- **Backend**
  - Unit test for `user_has_certification_access()`: no grants → true for any user; with grants → true only for grantees and admin.
- **UI**
  - Resources page hides training materials whose `certificationSlug` is not in the user's accessible certs.
  - Admin can grant and revoke access; mutations invalidate queries; list of grantees updates.
  - Revoke-last-grant confirmation modal works and opens cert to everyone after confirm.
- **Validation**
  - Test that every `certificationSlug` in TRAINING_ENTRIES matches an existing certification (slug) from the app or fixture.

---

## 6. Files to touch (unchanged from original, plus tests)

- **Migrations**: Create `certification_access_grants` (with `granted_by` ON DELETE SET NULL), indexes, helper `user_has_certification_access`, update cert_types SELECT policy, add access checks in all relevant RPCs; **down migration** to drop table, indexes, and revert policy.
- **Types**: Add `CertificationAccessGrant` if needed.
- **Hooks**: `useCertificationAccessGrants(certId)`, `useGrantCertificationAccess()`, `useRevokeCertificationAccess()`; memoization in Resources as above.
- **Content**: trainingIndex — add `certificationSlug`; add **validation test** for slug consistency.
- **Resources.tsx**: Filter training with memoized `allowedSlugs` / `visibleTraining`.
- **ResourceDocView.tsx**: Check access for training docs with `certificationSlug`.
- **AdminCertifications.tsx**: Restyle + "Access by certification" + restriction badge + "Manage access" modal (grantees + user picker, revoke confirm for last grant).

---

## 7. Risk summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| Last grant deletion opens cert to everyone | Medium | Confirmation modal; optional `is_restricted` later |
| Slug mismatch breaks training filter | Medium | Validation test in CI |
| RLS performance with many grants | Low–Medium | Indexes on cert_id and (user_id, cert_id) |
| User access revoked mid-attempt | Medium | RPCs re-check access; clear "access denied" message in UI |
| granted_by lost if admin deleted | Low | ON DELETE SET NULL on granted_by |

---

## 8. Out of scope (V1)

- Audit log table for revocations; notifications on grant/revoke; bulk matrix UI; `is_restricted` flag on certification_types; multiple study guides per cert (`certificationSlug[]`).
