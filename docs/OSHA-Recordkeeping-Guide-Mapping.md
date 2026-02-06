# OSHA Recordkeeping Guide — App Mapping Reference

**Source:** OSHA Recordkeeping Guide (Zywave/Higginbotham, ©2023). Provided for compliance context; not legal advice.

This document maps the OSHA Recordkeeping Guide PDF to the app’s `osha_compliance_mapping` table and `safety_incidents` usage.

---

## Guide sections → App implementation

| Guide section | 29 CFR | App data source / behavior |
|---------------|--------|----------------------------|
| **Reporting fatalities and injuries** | 1904.39 | `safety_incidents`: severity (fatality), hospitalized_overnight, amputation/eye; `osha_reportable`, `osha_reported`, `osha_report_date`. Reporting to 1-800-321-OSHA or ITA is process, not automated in app. |
| **When to report** | 1904.39 | Fatality 8 hr; hospitalization/amputation/eye 24 hr — app flags via severity and fields; actual report is manual or future workflow. |
| **Recordkeeping forms (300, 300A, 301)** | 1904.29 | Form 300: `get_incident_log_osha_300_301`, `exportOsha300Csv`. Form 301: incident fields (what_doing_before, object_substance_harmed, incident_time, physician_name, treatment_facility, time_began_work, employee_hire_date). Form 300A: not yet auto-generated; 5-year retention in place. |
| **Recordable injuries and illnesses** | 1904.4, 1904.7 | Death, loss of consciousness, days away, restricted work, medical treatment beyond first aid — captured in `safety_incidents` (severity, days_away_from_work, days_restricted_duty). `validate_recordable_incidents` trigger enforces recordable logic. |
| **Significant diagnosed (cancer, fracture, punctured eardrum, etc.)** | 1904.7 | `injury_illness_type`, severity, and description support recording; no separate “significant diagnosed” flag. |
| **Needlestick / contaminated sharps** | 1904.8 | Recordable via severity and description; no dedicated needlestick code. |
| **Determining work-relatedness** | 1904.5 | Work-relatedness implied via job_id, work_site_name, description; no explicit work-related checkbox. |
| **Posting Form 300A** | 1904.32 | Feb 1–April 30 — 300A not auto-generated; posting process outside app. |
| **Privacy concern cases** | 1904.12 | No “privacy case” or name-withhold flag yet; separate confidential list is policy. |
| **Electronic reporting (ITA)** | 1904.41 | March 2 annual submission — 300A data derivable from safety_incidents; ITA submission manual or future automation. |
| **Retention (5 years)** | 1904.33 | `data_retention_policies`: safety_incidents 1825 days. |
| **Employee access to records** | 1904.35 | RLS and admin/safety officer access; provide copy by next business day per policy. |

---

## Definitions (Guide) → App

- **First aid vs medical treatment:** Incident severity and treatment fields support “medical treatment beyond first aid”; first-aid-only cases can be recorded as non-recordable (e.g. first_aid severity).
- **Work environment:** Captured via work_site_name, job_id, and description.
- **Restricted work:** `days_restricted_duty` in safety_incidents.

---

## Table: osha_compliance_mapping

The migration `20260304000000_expand_osha_compliance_mapping.sql` adds rows for 1904.39 (reporting), 1904.29 (300/301), 1904.32 (posting), 1904.35 (access), 1904.41 (electronic), 1904.7 (recording criteria), 1904.8 (needlestick), 1904.12 (privacy), 1904.5 (work-relatedness), 1904.6 (new case), 1904.0 (partial exemption), plus 1926.32, 1926.50, 1910.38, 1926.503, 1926.21(b)(2), 1904.31. The Admin Compliance Audit page reads `osha_compliance_mapping` for the regulation-to-datasource table.

---

## Gaps vs guide

1. **Form 300A:** No automated generation or posting; ITA submission not in app.
2. **Privacy concern cases:** No “privacy case” or name-withhold field in safety_incidents.
3. **301 within 7 days:** Workflow not enforced in app (e.g. no “must complete within 7 days” rule).
4. **New case (1904.6):** No 180-day same-injury duplicate check.

These are reflected in the Compliance Gap Analysis and prioritization (e.g. Automated OSHA 300A, privacy-case flag).
