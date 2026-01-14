/*
  ============================================================================
  ADD MECHANIC COST TRACKING FIELDS
  ============================================================================
  
  This migration adds cost tracking fields to DVIR reports and equipment 
  inspections so mechanics can log repair costs when recording fixes.
  
  Previously, only vehicle_maintenance_log tracked costs. Now we can capture
  costs from all fix sources for comprehensive cost analysis.
  
  ============================================================================
*/

-- ============================================================================
-- ADD COST FIELDS TO DVIR_REPORTS
-- ============================================================================

ALTER TABLE public.dvir_reports 
ADD COLUMN IF NOT EXISTS mechanic_cost numeric DEFAULT NULL;

ALTER TABLE public.dvir_reports 
ADD COLUMN IF NOT EXISTS mechanic_parts_used jsonb DEFAULT '[]'::jsonb;

-- Constraint for valid cost
ALTER TABLE public.dvir_reports 
ADD CONSTRAINT dvir_mechanic_cost_positive 
CHECK (mechanic_cost IS NULL OR mechanic_cost >= 0);

-- Constraint for parts_used array
ALTER TABLE public.dvir_reports 
ADD CONSTRAINT dvir_parts_used_is_array 
CHECK (mechanic_parts_used IS NULL OR jsonb_typeof(mechanic_parts_used) = 'array');

COMMENT ON COLUMN public.dvir_reports.mechanic_cost IS 
  'Cost of repairs/parts used to fix deficiencies in this DVIR';

COMMENT ON COLUMN public.dvir_reports.mechanic_parts_used IS 
  'Array of parts used: [{part_name, quantity, part_number, cost}]';

-- ============================================================================
-- ADD COST FIELDS TO DAILY_EQUIPMENT_INSPECTIONS
-- ============================================================================

ALTER TABLE public.daily_equipment_inspections 
ADD COLUMN IF NOT EXISTS mechanic_cost numeric DEFAULT NULL;

ALTER TABLE public.daily_equipment_inspections 
ADD COLUMN IF NOT EXISTS mechanic_parts_used jsonb DEFAULT '[]'::jsonb;

-- Constraint for valid cost
ALTER TABLE public.daily_equipment_inspections 
ADD CONSTRAINT equipment_mechanic_cost_positive 
CHECK (mechanic_cost IS NULL OR mechanic_cost >= 0);

-- Constraint for parts_used array
ALTER TABLE public.daily_equipment_inspections 
ADD CONSTRAINT equipment_parts_used_is_array 
CHECK (mechanic_parts_used IS NULL OR jsonb_typeof(mechanic_parts_used) = 'array');

COMMENT ON COLUMN public.daily_equipment_inspections.mechanic_cost IS 
  'Cost of repairs/parts used to fix issues in this inspection';

COMMENT ON COLUMN public.daily_equipment_inspections.mechanic_parts_used IS 
  'Array of parts used: [{part_name, quantity, part_number, cost}]';

-- ============================================================================
-- CREATE INDEXES FOR COST QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_dvir_mechanic_cost 
ON public.dvir_reports(mechanic_cost) 
WHERE mechanic_cost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_mechanic_cost 
ON public.daily_equipment_inspections(mechanic_cost) 
WHERE mechanic_cost IS NOT NULL;

-- ============================================================================
-- CREATE VIEW FOR UNIFIED FIX COSTS
-- ============================================================================

CREATE OR REPLACE VIEW public.unified_fix_costs AS
SELECT 
  'repairs_log' as source,
  id as source_id,
  truck_number as asset_number,
  'truck' as asset_type,
  maintenance_type as fix_type,
  description,
  cost as recorded_cost,
  parts_used,
  service_date as fix_date,
  performed_by_name as performed_by,
  mileage_at_service as mileage,
  created_at
FROM public.vehicle_maintenance_log

UNION ALL

SELECT 
  'dvir' as source,
  id as source_id,
  COALESCE(truck_number, mechanic_truck_number) as asset_number,
  'truck' as asset_type,
  'dvir_fix' as fix_type,
  deficiency_corrected as description,
  mechanic_cost as recorded_cost,
  mechanic_parts_used as parts_used,
  COALESCE(mechanic_date::date, created_at::date) as fix_date,
  NULL as performed_by,
  mileage,
  created_at
FROM public.dvir_reports
WHERE deficiency_corrected IS NOT NULL AND deficiency_corrected != ''

UNION ALL

SELECT 
  'equipment' as source,
  id as source_id,
  equipment_number as asset_number,
  CASE 
    WHEN LOWER(equipment_type) LIKE '%chipper%' THEN 'chipper'
    WHEN LOWER(equipment_type) LIKE '%trailer%' THEN 'trailer'
    ELSE 'equipment'
  END as asset_type,
  'equipment_fix' as fix_type,
  mechanic_fixes as description,
  mechanic_cost as recorded_cost,
  mechanic_parts_used as parts_used,
  COALESCE(last_mechanic_updated_at::date, inspection_date::date) as fix_date,
  NULL as performed_by,
  NULL as mileage,
  created_at
FROM public.daily_equipment_inspections
WHERE mechanic_fixes IS NOT NULL AND mechanic_fixes != '';

COMMENT ON VIEW public.unified_fix_costs IS 
  'Unified view of all fixes with costs from maintenance logs, DVIRs, and equipment inspections';

-- ============================================================================
-- CREATE MATERIALIZED VIEW FOR ASSET COST SUMMARY
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.asset_cost_summary AS
SELECT 
  asset_number,
  asset_type,
  COUNT(*) as total_fixes,
  SUM(COALESCE(recorded_cost, 100)) as total_estimated_cost,
  SUM(recorded_cost) as total_recorded_cost,
  MAX(fix_date) as last_fix_date,
  MIN(fix_date) as first_fix_date,
  jsonb_agg(DISTINCT fix_type) as fix_types
FROM public.unified_fix_costs
WHERE asset_number IS NOT NULL AND asset_number != ''
GROUP BY asset_number, asset_type
ORDER BY total_estimated_cost DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_cost_summary_pk 
ON public.asset_cost_summary(asset_type, asset_number);

COMMENT ON MATERIALIZED VIEW public.asset_cost_summary IS 
  'Pre-aggregated cost summary per asset for fast dashboard queries. Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY public.asset_cost_summary;';

-- ============================================================================
-- CREATE FUNCTION TO REFRESH MATERIALIZED VIEW
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_asset_cost_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.asset_cost_summary;
END;
$$;

COMMENT ON FUNCTION public.refresh_asset_cost_summary IS 
  'Refreshes the asset_cost_summary materialized view. Call after bulk data changes.';

-- ============================================================================
-- CREATE TRIGGER TO AUTO-REFRESH (optional, can be expensive)
-- ============================================================================
-- Note: For production, consider refreshing via cron job instead

-- Create a simple trigger function that queues a refresh
CREATE OR REPLACE FUNCTION public.queue_asset_cost_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Just mark that a refresh is needed (actual refresh via cron/background job)
  -- This avoids expensive refreshes on every insert
  PERFORM pg_notify('asset_cost_refresh_needed', '');
  RETURN NULL;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
/*
-- Check new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'dvir_reports' 
AND column_name IN ('mechanic_cost', 'mechanic_parts_used');

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'daily_equipment_inspections' 
AND column_name IN ('mechanic_cost', 'mechanic_parts_used');

-- Test unified view
SELECT source, COUNT(*), SUM(recorded_cost) as total_cost
FROM unified_fix_costs
GROUP BY source;

-- Test materialized view
SELECT * FROM asset_cost_summary ORDER BY total_estimated_cost DESC LIMIT 10;
*/
