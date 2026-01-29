# Phase 1 GitHub Issues (Safety Compliance Audit)

Use these as templates to create GitHub issues for Phase 1 of the Safety Compliance System Audit roadmap.

---

## Issue 1: Create Directives Layer (P0)

**Title:** [P0] Create directive files for safety-agent workflows (3-layer architecture)

**Labels:** `priority: p0`, `safety-agent`, `documentation`

**Description:**

The `src/services/safety-agent/directives/` folder was empty, violating the 3-layer architecture (Directive → Orchestration → Execution). Business logic was embedded in execution scripts, making the system harder to maintain and audit.

**Done:** Directive files have been added for:
- `daily_safety_announcement.md` – Daily safety announcement generation (7 AM CST)
- `admin_compliance_9am.md` – Admin compliance summary (9 AM CST)
- `smart_defaults.md` – Smart form defaults (AI tie-breaking, no PII to LLM)

**Remaining / follow-up:**
- [ ] Add directive files for any other workflows (e.g. weather forecast, publish announcement) if they are first-class workflows.
- [ ] Ensure all execution scripts reference their directive in comments or README.
- [ ] Review directives with stakeholders and update with learnings (API limits, edge cases).

**Acceptance criteria:**
- [ ] Every safety-agent workflow that has an execution script has a corresponding directive in `directives/`.
- [ ] Directives document: Goal, Inputs, Tools/Scripts, Outputs, Business Rules, Edge Cases, Acceptance Criteria.
- [ ] README or index in `directives/` lists all directives and their purpose.

**References:** Safety Compliance System Audit (Phase 1), plan: Create Directives Layer.

---

## Issue 2: Offline Submission Queue (P0)

**Title:** [P0] Implement offline submission queue for safety forms (Service Worker + IndexedDB)

**Labels:** `priority: p0`, `safety-forms`, `offline`, `ux`

**Description:**

Field workers operate in areas with poor connectivity. Current draft persistence only saves in-progress forms; it does not support true offline queue/submission. Submissions are lost if the network fails during submit, risking compliance failures.

**Done (foundation):**
- `src/lib/offlineQueue.ts` – IndexedDB queue with add, process, exponential backoff, conflict check hook.
- `src/hooks/useOfflineQueue.ts` – Hook for `isOnline`, `queueLength`, `pendingItems`, `addToQueue`, `processQueueNow`, `removeFromQueue`; auto-processes queue when app comes back online.

**Remaining:**
- [ ] **Integration:** In each safety form (JSA, DVIR, Equipment), when submit is attempted:
  - If `!navigator.onLine` (or submit fails with network error), call `addToQueue(formType, payload, { userId, dateFor })` and show UI: "Queued for when you're back online."
  - Ensure a global submitter is registered (e.g. via context) that performs the same Supabase insert as the form’s submit handler.
- [ ] **Conflict resolution:** Before processing a queued item, check if the user already submitted for that form type + date (e.g. user submitted online in another tab). If so, discard the queued item or prompt user.
- [ ] **DVIR + photos:** Queue currently stores JSON only. Add support for storing photo Blobs in IndexedDB (or prompt "Submit when online" for DVIR with photos until implemented).
- [ ] **UI:** Offline indicator in header/nav with queued count; "Sync now" button that calls `processQueueNow()`.
- [ ] **Service worker:** Existing PWA SW (`src/sw.ts`) is used; queue is processed on window `online` in the hook. Optionally add Background Sync API later for retry when app is closed.

**Acceptance criteria:**
- [ ] User can submit JSA (and Equipment, if applicable) while offline; submission is queued and synced when back online.
- [ ] Queued count is visible when offline; user can trigger sync when online.
- [ ] Duplicate submissions (same form type + date) are avoided (discard or merge).
- [ ] Exponential backoff used for retries; no spamming the server when offline for extended period.

**References:** Safety Compliance System Audit – Offline Submission Queue enhancement; plan: Phase 1.

---

## Issue 3: Data Retention Policies (P0)

**Title:** [P0] Implement data retention policies and automated archival for compliance records

**Labels:** `priority: p0`, `compliance`, `database`, `security`

**Description:**

No explicit data retention policies exist. OSHA requires 3-month retention for DVIRs; there is no automated purge or archival mechanism. This is a legal/compliance and storage cost concern.

**Tasks:**
- [ ] Create `data_retention_policies` table (e.g. `table_name`, `retention_days`, `archive_table_name`, `enabled`).
- [ ] Add migration and seed/default rows for DVIR (e.g. 3 months), JSA, Equipment (per policy).
- [ ] Implement archival function: move records older than retention period to archive table (or mark for purge).
- [ ] Schedule automated job (cron or Edge Function) to run archival daily/weekly.
- [ ] Optional: before purge, export to cold storage (e.g. S3 Glacier) for long-term compliance.
- [ ] Document retention policy in admin or compliance docs.

**Acceptance criteria:**
- [ ] Retention rules are configurable per table (e.g. DVIR: 90 days).
- [ ] Archival job runs on schedule and moves or flags old records.
- [ ] No active compliance data is deleted before the configured retention period.
- [ ] Audit trail or export exists for purged data if required.

**References:** Safety Compliance System Audit – Data Retention Policies; Appendix B schema.

---

## Issue 4: Image Signature Capture (P0)

**Title:** [P0] Add canvas-based image signature capture for safety forms

**Labels:** `priority: p0`, `safety-forms`, `compliance`, `ux`

**Description:**

Currently only text signatures are supported. For some regulatory requirements, image signatures provide a stronger audit trail and compliance. Text signatures are not always considered legally binding.

**Done:**
- `SignaturePad` component (`src/components/forms/SignaturePad.tsx`): uses existing `SignatureCanvas` for drawing; validates (min bounding box 40×15 px, min opaque pixels 80) via `src/lib/signatureValidation.ts`; uploads via `src/hooks/useSignatureUpload.ts` to bucket `signatures` (path `{userId}/{formType}/{timestamp}.png`); outputs storage path for form submission.
- Migration `20260229160000_signatures_storage_bucket.sql`: creates `signatures` bucket and extends storage validation to allow PNG uploads.
- **JSA integrated:** `employee_signature_path` on `daily_jsa` (migration `20260229170000`); StepReview shows SignaturePad + “Or type your name”; submission and validation accept path or text; JsaDetailModal shows image when path is set.

**Remaining:**
- [ ] Add `SignaturePad` to DVIR and Equipment forms (add `*_signature_path` columns and UI where desired).
- [ ] Keep existing text signature fields as fallback (already done for JSA).

**Acceptance criteria:**
- [ ] User can draw a signature on a canvas; it is saved as an image and stored in Supabase.
- [ ] Submission includes the signature image path; backend/RLS allows the field.
- [ ] Empty or trivial signatures are rejected by validation.
- [ ] Works on mobile (touch) and desktop (mouse).

**References:** Safety Compliance System Audit – Image Signature Capture; plan: Phase 1.

---

## Summary

| Issue | Priority | Status (foundation) |
|-------|----------|---------------------|
| 1 – Directives Layer | P0 | Done: 3 directive files added |
| 2 – Offline Queue | P0 | Done: lib + hook + provider + JSA integration + indicator |
| 3 – Data Retention | P0 | Done: migration + `run_data_retention()` + pg_cron schedule (daily 03:00 UTC) |
| 4 – Image Signature | P0 | Done: `SignaturePad` + validation + upload; JSA integrated (employee_signature_path) |

Create these issues in your repo and link them to the Safety Compliance System Audit plan.

---

## Phase 2 Next Steps (from Audit)

After applying Phase 1 migrations and verifying behavior. **Note: Weather auto-population is out of scope**—JSA weather fields remain manual per product decision.

1. **Multi-language (P1)** – Spanish for forms and announcements; `preferred_language` on `app_users`; generate (not just translate) Spanish announcements.
2. **Individual manager notifications (P1)** – Email each manager about their direct reports’ compliance; add `manager_id` to `app_users`, implement `sendManagerComplianceEmail`.
3. **Photo compression & batch upload (P1)** – Client-side compression; multiple photos per checklist item.
4. **CSV/PDF exports (P1)** – OSHA 300 log and regulatory exports from analytics dashboard.

See `docs/Phase2-Plan.md` and the full Safety Compliance System Audit plan for Phase 2/3 details.
