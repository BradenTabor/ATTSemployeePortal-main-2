-- DVIR pre-trip vs post-trip inspection type and defect correction (49 CFR 396.11/396.13).
-- Agent 4: Tree Felling JSA, Equipment & DVIR

ALTER TABLE dvir_reports
  ADD COLUMN IF NOT EXISTS inspection_type TEXT
    CHECK (inspection_type IN ('pre_trip', 'post_trip'))
    DEFAULT 'pre_trip';

COMMENT ON COLUMN dvir_reports.inspection_type IS 'Pre-trip (default) or post-trip vehicle inspection.';

-- 49 CFR 396.13(b)(3): per-defect correction status (corrected vs need not be corrected).
ALTER TABLE dvir_reports
  ADD COLUMN IF NOT EXISTS defect_corrections JSONB;

COMMENT ON COLUMN dvir_reports.defect_corrections IS 'Map of checklist item id to corrected | need_not_be_corrected.';
