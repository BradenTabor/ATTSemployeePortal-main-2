# ATTS OSHA & Insurance Audit-Grade Compliance Engine — Approved Plan

This document merges the original forensic analysis and workflow design with Copilot’s review: corrections, schema additions, and prioritized implementation order. **Status: Approved for implementation.**

---

## Executive Summary

- **Phase 1 (Forensic):** Data intake, processing, and storage are accurately documented; critical gaps are incident traceability, immutable audit log, server-side validation, and incident retention.
- **Phase 2 (Regulatory):** OSHA (1910.269, 1926, 1904, 49 CFR 396) and insurance requirements are mapped; gaps include explicit LOTO/traffic control, 1910.269 briefing mapping, and 5-year incident retention.
- **Phase 3 (Workflows):** Three production-grade workflows are defined (Daily Pre-Work Compliance, Incident Recording, On-Demand Report Export); all approved with refinements below.

**Top priorities (P0):** safety_audit_log, incident job/crew/supervisor traceability, server-side validation, 5-year incident retention.

---

## Acceptance Criteria vs Current State (with Priorities)

| Criterion | Status | Action | Priority |
|-----------|--------|--------|----------|
| Every OSHA rule has a mapped data source | Partial | Create `osha_compliance_mapping` table; extend COMPLIANCE_TRACEABILITY | P1 |
| Every safety action produces a verifiable record | No | Create `safety_audit_log` (append-only) and write on submit/update | **P0** |
| Every record time-stamped and role-bound | Mostly | Add `updated_at`, `updated_by` where missing | P2 |
| Every report reproducible | Yes (design) | Implement reports with consistent filters and generation time | P1 |
| Every incident traceable to job, crew, supervisor | No | Add `job_id`, `crew_id`, `supervisor_id` to `safety_incidents` | **P0** |
| Reports generated in under 60 seconds | Not verified | Indexes, materialized views, max range, measure | P1 |

---

## Schema Additions (Approved)

### 1. safety_audit_log (append-only, tamper-evident)

```sql
CREATE TABLE public.safety_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,           -- e.g. dvir_submitted, jsa_completed, incident_created, report_exported
  table_name text NOT NULL,
  record_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload_snapshot jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No UPDATE/DELETE policies. INSERT only from app/triggers.
-- RLS: SELECT for admin/safety_officer only.
CREATE INDEX idx_safety_audit_log_occurred_at ON public.safety_audit_log(occurred_at DESC);
CREATE INDEX idx_safety_audit_log_table_record ON public.safety_audit_log(table_name, record_id);
```

**Use:** Triggers or app writes on INSERT/UPDATE for `dvir_reports`, `daily_jsa`, `daily_equipment_inspections`, `safety_incidents`. Log report requests with `event_type = report_exported`.

---

### 2. safety_incidents — traceability and corrective actions

```sql
ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES job_progress_trackers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_id uuid REFERENCES crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrective_actions_taken text,
  ADD COLUMN IF NOT EXISTS corrective_actions_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corrective_actions_at timestamptz;
```

**Use:** IncidentLoggingModal and useLogIncident capture job_id, crew_id, supervisor_id; validate when “on job.” Corrective actions for insurer defensibility.

---

### 3. daily_jsa — supervisor approval (P2)

```sql
ALTER TABLE public.daily_jsa
  ADD COLUMN IF NOT EXISTS supervisor_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supervisor_approved_at timestamptz;
```

**Use:** JSA form and review flow set these when a supervisor approves.

---

### 4. osha_compliance_mapping

```sql
CREATE TABLE public.osha_compliance_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  osha_regulation text NOT NULL,       -- e.g. "1910.269", "1904.4", "49 CFR 396.3"
  requirement_description text NOT NULL,
  data_source text NOT NULL,            -- e.g. "daily_jsa.hazards", "dvir_reports.checklists"
  validation_rule text,
  created_at timestamptz DEFAULT now()
);
```

**Use:** Seed with mappings from Phase 2 (1910.269, 1926.20/21/200, 1904, 49 CFR 396, etc.). Enables “every OSHA rule has a mapped data source.”

---

### 5. Data retention — incidents 5 years (OSHA 1904.33)

```sql
-- Add safety_incidents to data_retention_policies (1825 days = 5 years)
INSERT INTO public.data_retention_policies (table_name, date_column, retention_days, enabled)
VALUES ('safety_incidents', 'incident_date', 1825, true)
ON CONFLICT (table_name) DO UPDATE SET
  date_column = EXCLUDED.date_column,
  retention_days = EXCLUDED.retention_days,
  enabled = EXCLUDED.enabled,
  updated_at = now();
```

**Note:** Ensure `run_data_retention()` supports `safety_incidents` and its `date_column` (e.g. `incident_date`). Optional: add archive tables and COPY-then-DELETE for long-term retention.

---

### 6. Materialized view — compliance summary (P1)

```sql
CREATE MATERIALIZED VIEW public.compliance_summary_90d AS
SELECT
  date_for,
  COUNT(DISTINCT user_id) AS total_users,
  COUNT(DISTINCT CASE WHEN dvir_submitted THEN user_id END) AS dvir_compliant,
  COUNT(DISTINCT CASE WHEN jsa_submitted THEN user_id END) AS jsa_compliant,
  COUNT(DISTINCT CASE WHEN equipment_submitted THEN user_id END) AS equipment_compliant
FROM (
  -- Derive from compliance_runs + submissions; adjust to actual schema
  SELECT date_for, user_id,
    (dvir_count > 0) AS dvir_submitted,
    (jsa_count > 0) AS jsa_submitted,
    (equipment_count > 0) AS equipment_submitted
  FROM compliance_runs cr
  LEFT JOIN LATERAL (...) AS sub ON true
) t
WHERE date_for >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY date_for
ORDER BY date_for DESC;

-- Refresh nightly via cron
-- SELECT cron.schedule('refresh-compliance-summary', '0 2 * * *', 'REFRESH MATERIALIZED VIEW compliance_summary_90d');
```

**Use:** Fast “Compliance Summary by Day” report; target &lt;60s for 90-day range.

---

## Implementation Order (Approved)

### Phase 1: Foundation (P0 — Critical) — 0–30 days

| # | Task | Deliverables |
|---|------|---------------|
| 1 | Create `safety_audit_log` (append-only) | Migration `20260XXX_create_safety_audit_log.sql`; triggers or app writes for DVIR, JSA, Equipment, Incident; RLS read-only for admin/safety_officer |
| 2 | Add incident traceability + corrective actions | Migration `20260XXX_add_incident_traceability.sql` (job_id, crew_id, supervisor_id, corrective_actions_*); update IncidentLoggingModal.tsx, useLogIncident; backfill where possible |
| 3 | Server-side validation for critical fields | Edge Function `validate-safety-submission` or DB constraints; block submit when OSHA-required fields invalid (DVIR: signatures, checklists, photos; JSA: job date, location, hazards, PPE, signatures; Equipment: type, number, date, hydraulic photo; Incident: body_parts, what_doing_before if recordable) |
| 4 | Incident retention 5 years | Add `safety_incidents` to `data_retention_policies` with 1825 days; ensure `run_data_retention()` supports it (migration `20260XXX_update_retention_policies.sql`) |

### Phase 2: Compliance Mapping & Reports (P1) — 1–3 months

| # | Task | Deliverables |
|---|------|---------------|
| 5 | Create `osha_compliance_mapping` | Migration + seed (1910.269, 1926.20/21/200, 1904, 49 CFR 396, etc.); extend COMPLIANCE_TRACEABILITY.md |
| 6 | “Compliance Summary by Day” report | CSV/PDF from compliance_runs + submissions; target &lt;60s for 90-day range; UI in admin dashboard |
| 7 | “Incident Log (300/301)” report | CSV/PDF matching OSHA 300/301 templates; “Incident by job/crew/supervisor” view; target &lt;60s for 1-year range |
| 8 | Materialized views + report logging | `compliance_summary_90d` (or equivalent), nightly refresh; log report requests in `safety_audit_log` (event_type = report_exported); rate limit (e.g. 10 reports/user/hour) |

### Phase 3: Enhancements (P2) — 3–6 months

| # | Task | Deliverables |
|---|------|---------------|
| 9 | JSA supervisor approval | Add supervisor_approved_by, supervisor_approved_at to daily_jsa; update JSA form/review flow |
| 10 | LOTO acknowledgment in JSA | Add loto_procedures_acknowledged (or similar) to daily_jsa; show when relevant hazards selected |
| 11 | Traffic control plan in JSA | Add traffic_control_plan text; show when “Traffic” hazard selected |
| 12 | Report request logging | Ensure all report exports write to safety_audit_log (report_type, date_range, requested_by) |

---

## Workflow Summary (Unchanged; Refinements Noted)

1. **Daily Pre-Work Compliance (DVIR + Equipment + JSA)**  
   Trigger: user submit or 9:00 AM cutoff. Validation: client + **server-side re-check**. Storage: existing tables + optional compliance_run_id. **Audit: safety_audit_log.** Reports: daily summary + on-demand CSV/PDF with **&lt;60s SLA** for standard range.

2. **Incident and Near-Miss Recording**  
   Trigger: IncidentLoggingModal submit. **New fields: job_id, crew_id, supervisor_id, corrective_actions_*.** Validation: recordable → body_parts, what_doing_before; server-side. Audit: safety_audit_log. Reports: OSHA 300 log, OSHA 301 report, “Incident by job/crew/supervisor.”

3. **On-Demand Audit and Regulator/Insurer Report Export**  
   Trigger: admin/safety_officer request. Validation: role, date range within retention, max range. **Log each request in safety_audit_log.** Reports: Compliance Summary, Incident (300/301); **&lt;60s for standard range; rate limit.**

---

## Key File References

- Forms: `src/pages/forms/DVIRForm.tsx`, `DailyJSAForm.tsx`, `DailyEquipmentInspectionForm.tsx`; `src/hooks/jsa/useJSASubmission.ts`, `src/hooks/dvir/useDVIRSubmission.ts`
- Compliance: `src/services/safety-agent/execution/checkCompliance9am.ts`, `supabase/functions/admin-compliance-cron/index.ts`
- Incidents: `src/hooks/queries/useRiskCalibration.ts`, `src/components/admin/IncidentLoggingModal.tsx`
- Traceability: `tests/COMPLIANCE_TRACEABILITY.md`; retention: `docs/DataRetention.md`
- Exports: `src/lib/exportUtils.ts`, `src/pages/admin/AdminJSA.tsx`, `src/pages/mechanic/equipment-logs/DVIRTab.tsx`

---

## Corrections and Notes (from Copilot Review)

- **Timezone:** No change; current handling is correct.
- **Retention:** Add 5-year policy for safety_incidents (OSHA 1904.33); optional archive tables.
- **Corrective actions:** Add corrective_actions_taken, corrective_actions_by, corrective_actions_at to incidents.
- **Supervisor approval:** Add supervisor_approved_by, supervisor_approved_at to daily_jsa (P2).
- **Weather:** Optional future enhancement: auto-populate JSA from weather forecast where applicable.

---

**Document version:** 1.0 (post–Copilot review)  
**Last updated:** 2026-01-28
