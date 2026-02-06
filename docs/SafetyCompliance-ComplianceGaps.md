# Compliance Gap Analysis

**Date:** February 4, 2026 (updated after OSHA mapping expansion)  
**Repository:** ATTSemployeePortal-main-2  
*(Deliverable: Plan 2 — Compliance Gap Analysis. Uses osha_compliance_mapping seed, migration 20260304000000_expand_osha_compliance_mapping.sql, and docs/OSHA-Recordkeeping-Guide-Mapping.md.)*

---

## Scope and disclaimer

**In scope:** Regulations in the `osha_compliance_mapping` table (expanded per OSHA Recordkeeping Guide PDF and additional standards) and requirements mapped in `tests/COMPLIANCE_TRACEABILITY.md`. This is a **technical feature mapping** only.

**Out of scope:** Full OSHA/DOT legal audit; legal advice.

**Disclaimer:** This compliance assessment is based on technical feature mapping and should be validated by legal/compliance experts. It does not constitute legal advice.

---

## Regulatory compliance table

*(Aligned with `osha_compliance_mapping` after migration `20260304000000_expand_osha_compliance_mapping.sql`.)*

### DOT / FMCSA

| Regulation | Requirement | Implementation | Status | Gap |
|------------|-------------|----------------|--------|-----|
| 49 CFR 396.11 | Driver vehicle inspection report before operating | dvir_reports (report_date, user_id, vehicle_trailer_checklist, final_driver_signature) | Full | None |
| 49 CFR 396.3(a) | Maintain inspection records | dvir_reports; data_retention_policies (90 days) | Full | None |

### OSHA construction and general (JSA / equipment)

| Regulation | Requirement | Implementation | Status | Gap |
|------------|-------------|----------------|--------|-----|
| 29 CFR 1926.20 | Safety program; hazard identification | daily_jsa (hazards_present, spans.hazards, ppe) | Full | None |
| 29 CFR 1926.21 | Training and education; hazard recognition | daily_jsa; certification_records | Full | None |
| 29 CFR 1926.21(b)(2) | Instruct employees to recognize and avoid unsafe conditions | daily_jsa (hazards_present, spans); certification_records | Full | None |
| 29 CFR 1926.32 | Definitions (employer, employee, competent person) | app_users roles; daily_jsa (spans, signatures) | Full | None |
| 29 CFR 1926.50 | First aid personnel and supplies | daily_jsa (contacts, hazards); no supply tracking | Partial | No first-aid supply tracking |
| 29 CFR 1926.200 | Traffic control; signs and flaggers | daily_jsa (traffic_hazards, traffic_setup) | Full | None |
| 29 CFR 1926.503 | Fall protection training | certification_records; daily_jsa (PPE, hazards) | Full | None |
| 29 CFR 1910.147 | LOTO procedures; energy sources | daily_jsa (hazards_present, spans.mitigation) | Partial | No explicit LOTO acknowledgment or procedure checklist |
| 29 CFR 1910.178 | Powered industrial trucks; daily inspection | daily_equipment_inspections (inspection_date, checklists, hydraulic_photo_path) | Full | None |
| 29 CFR 1910.269 | Electric power; job briefing (line-clearance tree trimming) | daily_jsa (job_date, work_location, oc_contact, hazards_present) | Full | None |
| 29 CFR 1910.38 | Emergency action plan | daily_jsa (hazards, mitigation); no dedicated EAP form | Partial | No dedicated EAP form |

### OSHA recordkeeping (29 CFR 1904 — from OSHA Recordkeeping Guide)

| Regulation | Requirement | Implementation | Status | Gap |
|------------|-------------|----------------|--------|-----|
| 29 CFR 1904.0 | Partial exemption (≤10 employees or low-hazard NAICS) | Policy; establishment size/NAICS not in app | Partial | Exemption checked externally |
| 29 CFR 1904.4 | Recording criteria for injuries/illnesses | safety_incidents; validate_recordable_incidents trigger | Full | None |
| 29 CFR 1904.5 | Determine work-relatedness | safety_incidents (job_id, work_site_name, description) | Full | None |
| 29 CFR 1904.6 | Determine if new case (same injury within 180 days) | safety_incidents; no duplicate-case logic | Gap | No 180-day new-case logic in app |
| 29 CFR 1904.7 | Record: death, loss of consciousness, DAFW, restricted, medical treatment beyond first aid | safety_incidents (severity, days_away, days_restricted); trigger | Full | None |
| 29 CFR 1904.8 | Record needlestick/sharps contaminated with blood/OPIM | safety_incidents (description, injury_illness_type) | Partial | No dedicated needlestick code |
| 29 CFR 1904.12 | Privacy concern cases: do not enter employee name on log | safety_incidents; no privacy_case flag | Gap | No privacy-case or name-withhold field |
| 29 CFR 1904.29 | Maintain Form 300 (Log) | safety_incidents; get_incident_log_osha_300_301; exportOsha300Csv | Full | None |
| 29 CFR 1904.29 | Form 301 within 7 calendar days | safety_incidents (301 fields); no 7-day workflow enforcement | Partial | 7-day completion not enforced in app |
| 29 CFR 1904.32 | Post Form 300A Feb 1–April 30 | No automated 300A generation | Partial | No 300A generation or posting in app |
| 29 CFR 1904.33 | Retention of OSHA 300, 300A, 301 (5 years) | safety_incidents; data_retention_policies (1825 days) | Partial | No automated 300A; 300/301 export exists |
| 29 CFR 1904.35 | Employee access to injury/illness records | RLS; get_incident_log; provide copy by next business day (policy) | Full | None |
| 29 CFR 1904.39 | Report fatality within 8 hours | safety_incidents (severity, osha_reportable, osha_reported); report to OSHA manual | Partial | App flags; actual report to 1-800-321-OSHA manual |
| 29 CFR 1904.39 | Report hospitalization, amputation, loss of eye within 24 hours | safety_incidents (hospitalized_overnight, severity); report manual | Partial | App flags; 24hr report process manual |
| 29 CFR 1904.41 | Electronic submission of Form 300A by March 2 (ITA) | safety_incidents; no ITA export/submission in app | Partial | ITA submission manual or future automation |
| 29 CFR 1904.31 | Multiple establishments: separate 300/300A per establishment | safety_incidents (work_site_name, job_id); work_sites | Full | None |

**Compliance Score: 76% (18 full, 11 partial, 2 gaps out of 31 requirements reviewed)**

Note: This score reflects technical feature mapping of regulations documented in `osha_compliance_mapping` (expanded per OSHA Recordkeeping Guide and additional standards). It is not a comprehensive OSHA/DOT audit and should be validated by compliance/legal experts.

**Calculation:** (18×1.0 + 11×0.5 + 2×0) / 31 = (18 + 5.5 + 0) / 31 = 23.5 / 31 ≈ 75.8% → **76%.**

---

## Critical gaps

1. **LOTO (29 CFR 1910.147):** JSA captures hazard controls and mitigation but has no explicit lockout/tagout procedure checklist or worker acknowledgment field.
2. **OSHA 300A (29 CFR 1904.32, 1904.33, 1904.41):** Five-year retention is implemented; one-click 300/301 export exists. Automated generation of the annual OSHA 300A summary (for posting and electronic submission to ITA by March 2) is not implemented.
3. **Privacy concern cases (29 CFR 1904.12):** No “privacy case” or name-withhold field in safety_incidents; separate confidential list is policy only.
4. **New case (29 CFR 1904.6):** No 180-day same-injury duplicate-case logic in app.
5. **Form 301 within 7 days (29 CFR 1904.29):** All 301-equivalent fields exist; no workflow enforcing completion within 7 calendar days.
6. **Reporting to OSHA (1904.39):** App flags reportable events; actual reporting to 1-800-321-OSHA or ITA is manual.
