-- LOTO (Lockout/Tagout) fields for equipment inspections when items are marked Fail.
-- Agent 4: Tree Felling JSA, Equipment & DVIR

ALTER TABLE daily_equipment_inspections
  ADD COLUMN IF NOT EXISTS loto_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS loto_data JSONB;

COMMENT ON COLUMN daily_equipment_inspections.loto_required IS 'True when any checklist item is Fail and equipment type requires LOTO.';
COMMENT ON COLUMN daily_equipment_inspections.loto_data IS 'LOTO procedure data (who, when, locks applied, etc.).';
