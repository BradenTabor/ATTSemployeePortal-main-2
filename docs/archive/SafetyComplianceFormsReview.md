# Safety Compliance Forms Audit

**Audit date:** January 29, 2026  
**Scope:** All safety-related forms in the ATTS Employee Portal.

---

## 1. Executive Summary

The portal has **four safety compliance form surfaces**:

| Form | Regulation / Standard | Role | Daily Compliance Tracked |
|------|------------------------|------|---------------------------|
| **DVIR** (Daily Vehicle Inspection Report) | 49 CFR 396 (FMCSA) | Driver, Foreman, Mechanic | Yes |
| **Daily JSA** (Job Safety Analysis) | 29 CFR 1926.20/21, 1910.147, 1926.200, 1910.269 | Employee, Foreman | Yes |
| **Daily Equipment Inspection** | 29 CFR 1910.178, ANSI S390.1 / Z133 / B71.4 | Field ops | Yes |
| **Safety Incident Logging** (OSHA 300/301) | 29 CFR 1904.4, 1904.33 | Admin / GF / Safety Officer | No (incident-based) |

**Request Time Off (RTO)** is an HR form and is **not** part of safety compliance; it is not included in the daily compliance status (DVIR / Equipment / JSA).

---

## 2. Form-by-Form Audit

### 2.1 DVIR (Daily Vehicle Inspection Report)

**Purpose:** Pre-trip and post-trip driver vehicle inspection per DOT FMCSA 49 CFR 396.

**Location:** `src/pages/forms/DVIRForm.tsx`, `src/pages/forms/dvir/`

**Regulation mapping (see `tests/COMPLIANCE_TRACEABILITY.md`):**
- **396.11:** Written report, driver/vehicle ID, date, inspection items, deficiencies, driver signature, certification.
- **396.13:** Supervisor review, corrective action, mechanic signature.
- **396.3(a):** Record retention (app: 90 days per `data_retention_policies`).

**Implementation:**

| Area | Details |
|------|--------|
| **State / types** | `DVIRFormState` in `dvir/types.ts`; checklist keys from `VEHICLE_TRAILER_ITEMS`, `AERIAL_LIFT_ITEMS`. |
| **Validation** | `useDVIRFormValidation` in `src/hooks/dvir/useDVIRFormValidation.ts`: truck number, driver name, mileage (vs `previousMileage`), full vehicle/trailer checklist, oil dipstick photo, at least one signature (driver or foreman). |
| **Photos** | `useDVIRPhotoUpload`: oil dipstick required; extra photos optional. Storage bucket usage. |
| **Submission** | `useDVIRSubmission`; inserts into `dvir_reports` with `report_date` (Chicago date). |
| **Persistence** | Draft auto-save via `useFormPersistence` (formType: `dvir`). Template from history via `sessionStorage['dvir-template']`. |
| **Compliance** | Included in `useComplianceQuery` (today's DVIR per user). Dashboard uses this for "today's compliance" (DVIR / Equipment / JSA). |

**Database:** `dvir_reports`; RLS allows own insert/select; supervisors and mechanics have select/update per migration `20260101000000_allow_supervisors_to_view_safety_equipment.sql`.

**Tests:**
- E2E: `tests/e2e/dvir-form.spec.ts` (happy path, validation, photo).
- Unit: `tests/unit/dvir-validation.test.ts`, `DVIRFormValidation.integration.test.tsx`, `DVIRSubmission.integration.test.tsx`, `dvir-submission.test.ts`.
- Factory: `tests/factories/dvirFactory.ts`.

**Gaps / notes:**
- COMPLIANCE_TRACEABILITY mentions audit trail immutability (e.g. `updated_at` logging) as a medium-risk gap.
- Offline submission queue is documented as not yet implemented (IndexedDB queue exists in `src/lib/offlineQueue.ts` / `OfflineQueueContext`; form submission path may not be fully wired).

---

### 2.2 Daily JSA (Job Safety Analysis)

**Purpose:** Job briefing and hazard identification per OSHA (e.g. 29 CFR 1926.20, 1926.21, 1910.147, 1926.200, 1910.269).

**Location:** `src/pages/forms/DailyJSAForm.tsx`, `src/components/forms/jsa-steps/`, `src/pages/forms/dailyJSAFormState.ts`

**Regulation mapping:**
- **1926.20:** Hazard identification, worker notification, documentation.
- **1910.147:** Energy sources, written procedures, worker acknowledgment.
- **1926.21:** Hazard recognition, PPE, site-specific hazards.
- **1926.200:** Traffic hazards, signs, flaggers.
- **1910.269:** Job briefing (line-clearance tree trimming).

**Implementation:**

| Area | Details |
|------|--------|
| **State / types** | `DailyJsaFormState` in `dailyJSAFormState.ts`; steps: Job Info, Safety/PPE, Conditions, Site Hazards, Spans, Review. |
| **Validation** | `useJSAFormValidation` in `src/hooks/jsa/useJSAFormValidation.ts`: job date, work location, OC/DOC/GF/Safety contacts (phone), jobs performed, employee signature (or `employeeSignaturePath`); spans: at least one with location or hazards. |
| **Submission** | `useJSASubmission`; inserts/updates `daily_jsa`; supports draft vs complete; employee signature path for image capture. |
| **Persistence** | Draft recovery and URL step sync (`?step=`); no separate `useFormPersistence` for JSA in the same way as DVIR/Equipment (JSA uses different flow). |
| **Compliance** | Included in `useComplianceQuery` (today's JSA per user by `job_date`). |

**Database:** `daily_jsa`; RLS for own insert/select; supervisor select per migration above. Retention 365 days per `data_retention_policies`.

**Tests:**
- E2E: `tests/e2e/jsa-form.spec.ts` (wizard, steps, validation).
- Unit: `tests/unit/jsa-validation.test.ts`, `useJSASubmission.test.ts`, `jsa-submission.test.ts`, `JSAWizardDraftStatus.integration.test.tsx`.
- Factory: `tests/factories/jsaFactory.ts`.

**Gaps / notes:**
- Deep link step validation (numeric, 1–6) and XSS caution noted in code (e.g. `getInitialStep`).
- Tree Felling JSA variant exists (`TreeFellingJSAForm.tsx`); confirm if it shares same compliance logic and tables.

---

### 2.3 Daily Equipment Inspection

**Purpose:** Daily inspection of field equipment (bucket trucks, chippers, mulchers, etc.) per 29 CFR 1910.178 and ANSI standards.

**Location:** `src/pages/forms/DailyEquipmentInspectionForm.tsx`

**Regulation mapping:**
- **1910.178:** Daily inspection, defect reporting, out-of-service, documentation.
- **ANSI S390.1, Z133, B71.4, etc.:** Visual inspection, hydraulics, safety devices, controls; equipment-specific checklists (Jarraff, Geo-Boy, Skidsteer, etc.).

**Implementation:**

| Area | Details |
|------|--------|
| **State / types** | `EquipmentFormState`: submittedBy, equipmentType, equipmentNumber, inspectionDate, template (sky_trim / geo_boy / skid_steer), generalChecklist, specificChecklist, notes. Equipment types: Geo-Boy, Grapple, Jarraff, Mulcher, Skidsteer. |
| **Validation** | Inline `useFormValidation` in `DailyEquipmentInspectionForm.tsx`: submittedBy, equipmentType, equipmentNumber, inspectionDate, full general checklist (20 items), hydraulic photo required. Specific checklist optional. |
| **Photos** | Overview, damage, attachments, **hydraulic** (required). Bucket: `equipment-inspection-photos`. Compression via `compressImage`. |
| **Submission** | Direct Supabase insert into `daily_equipment_inspections` with `inspection_date` (Chicago), checklist and photo paths. |
| **Persistence** | `useFormPersistence` (formType: `equipment`); draft modal and auto-restore same as DVIR. |
| **Compliance** | Included in `useComplianceQuery` (today's equipment inspection per user). |

**Database:** `daily_equipment_inspections`; RLS and supervisor select per same migration; retention 365 days. Additional photo path columns per `20260229200004_equipment_additional_photo_paths.sql`.

**Tests:**
- E2E: `tests/e2e/equipment-form.spec.ts` (per equipment type, validation, hydraulic photo).
- Factory: `tests/factories/equipmentFactory.ts`.
- No dedicated unit test file for equipment validation logic (validation lives inline in the page).

**Gaps / notes:**
- Consider extracting equipment validation into a dedicated hook (e.g. `useEquipmentFormValidation`) and adding unit tests for rules, aligned with DVIR/JSA.
- Template-specific checklists (e.g. Sky Trim vs Geo-Boy vs Skidsteer) are implemented; E2E covers all equipment types.

---

### 2.4 Safety Incident Logging (OSHA 300 / 301)

**Purpose:** Log safety incidents for OSHA 300 Log and 301 Incident Report; recordable detection and case numbers.

**Location:** `src/components/admin/IncidentLoggingModal.tsx`, `src/hooks/queries/useRiskCalibration.ts` (e.g. `useLogIncident`)

**Regulation mapping:**
- **29 CFR 1904.4:** Recording criteria (recordable, lost time, fatality).
- **29 CFR 1904.33:** Retention of OSHA 300, 300A, 301 (5-year in app per migrations).

**Implementation:**

| Area | Details |
|------|--------|
| **UI** | Modal form: severity (near_miss, first_aid, recordable, lost_time, fatality), work site, employee, job, crew, date/time, description, body parts, what doing before, etc. OSHA recordable options and case number generation. |
| **Validation** | Server-side and DB triggers: e.g. `validate_recordable_incidents` (migration `20260301000004_validate_recordable_incidents.sql`), `ensure_safety_incidents_case_number` (migration `20260301100000_ensure_safety_incidents_case_number.sql`). |
| **Submission** | `useLogIncident` / `useRiskCalibration`; inserts into `safety_incidents`. Traceability: job_id, crew_id, supervisor_id, corrective_actions_* (migration `20260301000002_add_incident_traceability.sql`). |
| **Compliance** | Not part of "daily compliance" (DVIR/Equipment/JSA). Used for analytics, OSHA 300/301 export (`get_incident_log_osha_300_301`), and weekly safety audit reports. |

**Database:** `safety_incidents`; RLS and admin/safety officer access; 5-year retention; OSHA 300/301 RPC and report access per migrations.

**Tests:**
- No dedicated E2E spec for incident logging modal in the audit scope; admin/safety flows may be partially covered in `admin-tools.spec.ts` or similar.

**Gaps / notes:**
- Add E2E coverage for opening the incident modal, filling required fields, and verifying recordable/case number behavior if not already present.
- Document which roles can open the modal (Admin, Safety Officer, GF) and any RLS checks.

---

## 3. Cross-Cutting Compliance Behavior

### 3.1 Daily Compliance Status

- **Source:** `useComplianceQuery` in `src/hooks/queries/useComplianceQuery.ts`.
- **Logic:** Single query for "today" (Chicago date) for current user:
  - **dvir:** has row in `dvir_reports` with `report_date = today`.
  - **equipment:** has row in `daily_equipment_inspections` with `inspection_date = today`.
  - **jsa:** has row in `daily_jsa` with `job_date = today`.
- **Usage:** Dashboard compliance strip/hero, compliance toasts ("all three done" celebration), and 9 AM admin compliance cron (missing DVIR/equipment notifications).

### 3.2 Draft Persistence and Recovery

- **DVIR and Equipment:** `useFormPersistence` with formType `dvir` / `equipment`; localStorage; draft recovery modal; auto-restore for very recent drafts (e.g. 60s).
- **JSA:** Different flow (wizard state, URL step, draft vs completed in DB); no localStorage-based persistence in the same hook.

### 3.3 Validation and Telemetry

- **Validation:** Shared `useFormValidation` and `validators` from `src/lib/formValidation.ts`; form-specific hooks for DVIR and JSA; Equipment uses inline rules.
- **Telemetry:** `trackFormStarted`, `trackFormSubmitted`, `trackFormSubmitError`, form timer; used across DVIR, JSA, Equipment, RTO.

### 3.4 Offline and RLS

- **Offline:** `OfflineQueueContext`, `offlineQueue.ts`, `OfflineSyncIndicator` exist; compliance forms may not be fully wired to the queue (see COMPLIANCE_TRACEABILITY gap).
- **RLS:** All three daily tables have user-scoped insert/select and supervisor select; DVIR has mechanic update policies. Incidents table has role-based access per migrations.

---

## 4. Test Coverage Summary

| Form | E2E | Unit / Integration | Factory |
|------|-----|--------------------|--------|
| DVIR | `dvir-form.spec.ts` | `dvir-validation.test.ts`, DVIR integration tests, `dvir-submission.test.ts` | `dvirFactory.ts` |
| JSA | `jsa-form.spec.ts` | `jsa-validation.test.ts`, `useJSASubmission.test.ts`, `jsa-submission.test.ts`, JSA wizard integration | `jsaFactory.ts` |
| Equipment | `equipment-form.spec.ts` | — (validation inline) | `equipmentFactory.ts` |
| Safety Incidents | Not specifically audited | useRiskCalibration / incident logging | — |

Accessibility and PWA/offline are covered at suite level (`accessibility.spec.ts`, `pwa-offline.spec.ts`). RLS and compliance logic are referenced in `COMPLIANCE_TRACEABILITY.md` and migrations.

---

## 5. Recommendations

1. **Equipment validation:** Extract validation rules into `useEquipmentFormValidation` and add unit tests (mirroring DVIR/JSA) for checklist and required photo rules.
2. **Offline submission:** Confirm whether DVIR, JSA, and Equipment submissions are enqueued and replayed via `OfflineQueueContext` when offline; if not, implement per COMPLIANCE_TRACEABILITY.
3. **Audit trail:** Add or document immutable audit trail for critical updates (e.g. DVIR mechanic sign-off, incident updates) if required for 396.11 or internal policy.
4. **Incident logging E2E:** Add E2E tests for the Incident Logging modal (required fields, recordable severity, case number visibility) and document role access.
5. **JSA variants:** Confirm Tree Felling JSA shares the same `daily_jsa` table and compliance logic and document any differences.
6. **90-day retention verification:** Add data lifecycle or retention tests for DVIR 90-day policy if needed for formal compliance evidence.

---

## 6. References

- `tests/COMPLIANCE_TRACEABILITY.md` – Regulation-to-test mapping and gaps
- `docs/ATTS-Compliance-Engine-Approved-Plan.md` – Compliance engine plan
- `supabase/migrations/20260301000005_create_osha_compliance_mapping.sql` – Regulation-to-table mapping
- `src/hooks/queries/useComplianceQuery.ts` – Daily compliance status
- `src/components/dashboard/QuickLinksRow.tsx` – Safety forms quick links (DVIR, Equipment, JSA)
