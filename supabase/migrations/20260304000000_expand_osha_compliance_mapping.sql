/*
  Expand OSHA Compliance Mapping (per OSHA Recordkeeping Guide PDF and additional standards)
  - Adds 29 CFR 1904 recordkeeping/reporting requirements from the OSHA Recordkeeping Guide
  - Adds additional OSHA construction and general industry standards for mapping accuracy
  - Reference: OSHA Recordkeeping Guide (Zywave/Higginbotham 2023); 29 CFR 1904, 1952
*/

-- =============================================================================
-- 29 CFR 1904 — Recordkeeping (from OSHA Recordkeeping Guide)
-- =============================================================================

INSERT INTO public.osha_compliance_mapping (osha_regulation, requirement_description, data_source, validation_rule)
VALUES
  -- Reporting (all covered employers)
  ('29 CFR 1904.39', 'Report work-related fatality within 8 hours', 'safety_incidents (severity=fatality); osha_reportable, osha_reported, osha_report_date', 'Fatality flagged; report to 1-800-321-OSHA or ITA'),
  ('29 CFR 1904.39', 'Report in-patient hospitalization, amputation, loss of eye within 24 hours', 'safety_incidents (hospitalized_overnight, severity); osha_reportable, osha_reported', 'Hospitalization/amputation/eye flagged; 24hr report'),
  ('29 CFR 1904.29', 'Maintain Form 300 (Log of Work-Related Injuries and Illnesses)', 'safety_incidents; get_incident_log_osha_300_301 RPC; exportOsha300Csv', 'Log fields: case_number, severity, body_parts, days_away, days_restricted, injury_illness_type'),
  ('29 CFR 1904.29', 'Complete Form 301 (Incident Report) within 7 calendar days', 'safety_incidents (what_doing_before, object_substance_harmed, incident_time, physician_name, treatment_facility, time_began_work, employee_hire_date)', '301-equivalent fields present; 7-day completion via app workflow'),
  ('29 CFR 1904.32', 'Post Form 300A Feb 1–April 30 annually', 'safety_incidents; data_retention_policies; (no automated 300A posting yet)', '300A summary from safety_incidents; posting process TBD'),
  ('29 CFR 1904.35', 'Employee access to injury/illness records', 'safety_incidents; RLS policies (admin, safety_officer, GF); get_incident_log_osha_300_301', 'RLS allows authorized access; provide copy by next business day'),
  ('29 CFR 1904.41', 'Electronic submission of Form 300A by March 2 (ITA)', 'safety_incidents; (no ITA export yet)', '300A data available; ITA submission manual or future automation'),
  ('29 CFR 1904.7', 'Record cases: death, loss of consciousness, days away, restricted work, medical treatment beyond first aid', 'safety_incidents (severity, days_away_from_work, days_restricted_duty); validate_recordable_incidents trigger', 'Recordable criteria enforced by trigger'),
  ('29 CFR 1904.8', 'Record needlestick/sharps contaminated with blood or OPIM', 'safety_incidents (description, injury_illness_type); severity/recordable logic', 'Case type and description support needlestick recording'),
  ('29 CFR 1904.12', 'Privacy concern cases: do not enter employee name on log', 'safety_incidents (involved_user_ids); (privacy-case flag not yet implemented)', 'Privacy cases: use confidential list; app could add privacy_case flag'),
  ('29 CFR 1904.5', 'Determine work-relatedness (event/exposure in work environment)', 'safety_incidents (description, work_site_name, job_id); incident logging workflow', 'Work-relatedness captured via job/site and description')
ON CONFLICT (osha_regulation, requirement_description) DO UPDATE SET
  data_source = EXCLUDED.data_source,
  validation_rule = EXCLUDED.validation_rule;

-- 1904.33 and 1904.4 already in seed; ensure no duplicate 1904.29 for 300/301
-- Add only if not present: 1904.6 (new case), 1904.0 (partial exemption) as reference rows

INSERT INTO public.osha_compliance_mapping (osha_regulation, requirement_description, data_source, validation_rule)
VALUES
  ('29 CFR 1904.6', 'Determine if case is new (same injury/illness within 180 days)', 'safety_incidents (incident_date, involved_user_ids); app logic or manual review', 'No duplicate case logic in app; manual or future automation'),
  ('29 CFR 1904.0', 'Partial exemption: ≤10 employees or low-hazard NAICS', 'app_users; establishment size/NAICS not stored in app', 'Policy: app used by covered employers; exemption checked externally')
ON CONFLICT (osha_regulation, requirement_description) DO UPDATE SET
  data_source = EXCLUDED.data_source,
  validation_rule = EXCLUDED.validation_rule;

-- =============================================================================
-- Additional OSHA construction and general industry (improve mapping accuracy)
-- =============================================================================

INSERT INTO public.osha_compliance_mapping (osha_regulation, requirement_description, data_source, validation_rule)
VALUES
  ('29 CFR 1926.32', 'Definitions (employer, employee, competent person, etc.)', 'app_users; roles (foreman, supervisor, mechanic); daily_jsa (spans, signatures)', 'Roles and JSA structure support competent person / employer definitions'),
  ('29 CFR 1926.50', 'First aid: adequate first aid personnel and supplies', 'daily_jsa (contacts, hazards); (no first-aid supply tracking)', 'JSA documents job site; first-aid adequacy is site-level policy'),
  ('29 CFR 1910.38', 'Emergency action plan (EAP)', 'daily_jsa (hazards_present, spans.mitigation); (no dedicated EAP form)', 'Hazard controls in JSA; formal EAP separate'),
  ('29 CFR 1926.503', 'Fall protection training', 'certification_records; daily_jsa (PPE, hazards)', 'Certifications and JSA document training and PPE'),
  ('29 CFR 1926.21(b)(2)', 'Instruct employees to recognize and avoid unsafe conditions', 'daily_jsa (hazards_present, spans); certification_records', 'JSA and certs support instruction documentation'),
  ('29 CFR 1904.31', 'Multiple establishments: separate 300/300A per establishment', 'safety_incidents (work_site_name, job_id); work_sites table', 'Incidents tied to work site; multi-establishment reporting possible')
ON CONFLICT (osha_regulation, requirement_description) DO UPDATE SET
  data_source = EXCLUDED.data_source,
  validation_rule = EXCLUDED.validation_rule;

COMMENT ON TABLE public.osha_compliance_mapping IS
  'Maps OSHA regulations to app data sources for compliance evidence. Expanded per OSHA Recordkeeping Guide (29 CFR 1904) and additional construction/general industry standards.';
