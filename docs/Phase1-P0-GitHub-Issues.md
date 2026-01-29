# Phase 1 (P0) — GitHub Issue Drafts

Copy each section below into a new GitHub issue. Labels: `compliance`, `P0`, `phase-1`.

---

## Issue 1: Create safety_audit_log (append-only, tamper-evident)

**Title:** `[P0] Create safety_audit_log table and triggers for DVIR, JSA, Equipment, Incident`

**Description:**

- Create append-only `safety_audit_log` table per [ATTS-Compliance-Engine-Approved-Plan.md](ATTS-Compliance-Engine-Approved-Plan.md).
- Columns: `id`, `event_type`, `table_name`, `record_id`, `user_id`, `role`, `occurred_at`, `payload_snapshot` (JSONB), `ip_address`, `created_at`.
- RLS: SELECT for admin/safety_officer only; no UPDATE/DELETE. INSERT: trigger function (SECURITY DEFINER) for table writes; allow admin/safety_officer to INSERT when `event_type = 'report_exported'`.
- Add DB triggers (or equivalent) on INSERT/UPDATE for:
  - `dvir_reports` → event_type e.g. `dvir_submitted` / `dvir_updated`
  - `daily_jsa` → `jsa_submitted` / `jsa_updated`
  - `daily_equipment_inspections` → `equipment_submitted` / `equipment_updated`
  - `safety_incidents` → `incident_created` / `incident_updated`
- Indexes: `occurred_at DESC`, `(table_name, record_id)`.

**Acceptance criteria:**

- [ ] Migration creates `safety_audit_log` and passes.
- [ ] Trigger function inserts one row per INSERT/UPDATE on the four tables above.
- [ ] Only admin/safety_officer can SELECT; no user can UPDATE/DELETE.

**Labels:** `compliance`, `P0`, `phase-1`

---

## Issue 2: Add incident traceability (job_id, crew_id, supervisor_id) and corrective actions

**Title:** `[P0] Add job_id, crew_id, supervisor_id and corrective_actions to safety_incidents`

**Description:**

- Add columns to `safety_incidents`: `job_id` (FK job_progress_trackers), `crew_id` (FK crews), `supervisor_id` (FK auth.users), `corrective_actions_taken` (text), `corrective_actions_by` (FK auth.users), `corrective_actions_at` (timestamptz). All nullable.
- Update `IncidentLoggingModal` and incident form state to capture job, crew, and supervisor (e.g. dropdowns from jobs/crews and supervisor derived or selected).
- Update `useLogIncident` and `IncidentFormData` to include and persist the new fields.
- Backfill existing incidents where possible (e.g. from work_site or other context); otherwise leave NULL.

**Acceptance criteria:**

- [ ] Migration adds columns and passes.
- [ ] Incident submit payload includes job_id, crew_id, supervisor_id; corrective_actions_* can be optional for initial release.
- [ ] UI allows selecting job and crew when logging an incident; supervisor can be derived from job/crew or selected.

**Labels:** `compliance`, `P0`, `phase-1`

---

## Issue 3: Server-side validation for critical OSHA fields

**Title:** `[P0] Server-side validation for critical safety form fields (DVIR, JSA, Equipment, Incident)`

**Description:**

- Add server-side re-check for OSHA-required fields so client-side validation cannot be bypassed.
- Options: Edge Function `validate-safety-submission` called before insert, and/or DB constraints (CHECK, NOT NULL) where applicable.
- DVIR: driver name, truck number, mileage, vehicle checklist, at least one signature, oil photo.
- JSA: job date, work location, contacts, at least one span with location or hazards, PPE, signatures when completed.
- Equipment: equipment type, equipment number, inspection date, hydraulic photo, checklists.
- Incident: description required; for recordable (recordable/lost_time/fatality): body_parts_affected length ≥ 1, what_doing_before non-empty.
- Block insert/update when validation fails; return clear error to client.

**Acceptance criteria:**

- [ ] Invalid payloads (e.g. missing required fields for recordable incident) are rejected by server/DB.
- [ ] Error messages are clear and actionable.

**Labels:** `compliance`, `P0`, `phase-1`

---

## Issue 4: Add safety_incidents to data_retention_policies (5 years)

**Title:** `[P0] Add safety_incidents to data_retention_policies with 5-year retention (OSHA 1904.33)`

**Description:**

- Add row to `data_retention_policies`: table_name `safety_incidents`, date_column `incident_date`, retention_days `1825` (5 years), enabled true.
- Ensure `run_data_retention()` already supports arbitrary tables with a date column (it does per existing implementation); no code change needed if so.
- Document in [DataRetention.md](DataRetention.md) that safety_incidents are retained 5 years per OSHA 1904.33.

**Acceptance criteria:**

- [ ] Migration inserts/updates `data_retention_policies` for safety_incidents.
- [ ] `run_data_retention()` deletes safety_incidents older than 5 years when run.
- [ ] DataRetention.md updated.

**Labels:** `compliance`, `P0`, `phase-1`
