/*
  OSHA Compliance Mapping (P1)
  Maps OSHA regulations to data sources for auditor/insurer evidence.
*/

CREATE TABLE IF NOT EXISTS public.osha_compliance_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  osha_regulation text NOT NULL,
  requirement_description text NOT NULL,
  data_source text NOT NULL,
  validation_rule text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (osha_regulation, requirement_description)
);

COMMENT ON TABLE public.osha_compliance_mapping IS
  'Maps OSHA regulations to app data sources for compliance evidence.';

CREATE INDEX IF NOT EXISTS idx_osha_compliance_mapping_regulation
  ON public.osha_compliance_mapping(osha_regulation);

-- =============================================================================
-- SEED: DVIR (49 CFR 396), JSA (1926.20/21/200, 1910.147), Equipment (1910.178), Incidents (1904)
-- =============================================================================
INSERT INTO public.osha_compliance_mapping (osha_regulation, requirement_description, data_source, validation_rule)
VALUES
  ('49 CFR 396.11', 'Driver vehicle inspection report before operating', 'dvir_reports (report_date, user_id, vehicle_trailer_checklist, final_driver_signature)', 'Pre-trip inspection documented'),
  ('49 CFR 396.3(a)', 'Maintain inspection records', 'dvir_reports; data_retention_policies (90 days)', 'Records retained 90 days'),
  ('29 CFR 1926.20', 'Safety program; hazard identification', 'daily_jsa (hazards_present, spans.hazards, ppe)', 'JSA documents hazards'),
  ('29 CFR 1926.21', 'Training and education; hazard recognition', 'daily_jsa (work_location, hazards_present); certification_records', 'JSA + certs'),
  ('29 CFR 1910.147', 'LOTO procedures; energy sources', 'daily_jsa (hazards_present, spans.mitigation)', 'Hazard controls documented'),
  ('29 CFR 1926.200', 'Traffic control; signs and flaggers', 'daily_jsa (traffic_hazards, traffic_setup)', 'Traffic hazards documented'),
  ('29 CFR 1910.178', 'Powered industrial trucks; daily inspection', 'daily_equipment_inspections (inspection_date, general_checklist, specific_checklist, hydraulic_photo_path)', 'Daily inspection documented'),
  ('29 CFR 1904.4', 'Recording criteria for injuries/illnesses', 'safety_incidents (severity, case_number, body_parts_affected, what_doing_before)', 'Recordable fields validated by trigger'),
  ('29 CFR 1904.33', 'Retention of OSHA 300, 300A, 301', 'safety_incidents; data_retention_policies (1825 days)', '5-year retention'),
  ('29 CFR 1910.269', 'Electric power; job briefing (line-clearance tree trimming)', 'daily_jsa (job_date, work_location, oc_contact, hazards_present)', 'Job briefing via JSA')
ON CONFLICT (osha_regulation, requirement_description) DO UPDATE SET
  data_source = EXCLUDED.data_source,
  validation_rule = EXCLUDED.validation_rule;

ALTER TABLE public.osha_compliance_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osha_compliance_mapping_select_admin_safety" ON public.osha_compliance_mapping;
CREATE POLICY "osha_compliance_mapping_select_admin_safety"
  ON public.osha_compliance_mapping FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_supervisor());
