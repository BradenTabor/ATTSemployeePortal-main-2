/*
  ============================================================================
  VEHICLE MAINTENANCE TRACKING SYSTEM
  ============================================================================
  
  This migration creates tables for tracking:
  - Vehicle maintenance logs (repairs, parts, upgrades)
  - Maintenance schedules (oil changes, tire rotations)
  - Mileage anomalies (error detection for odometer readings)
  
  Dependencies:
  - public.is_admin() function (from 20251212194400)
  - public.is_mechanic() function (from 20251212194400)
  - public.dvir_reports table (from 20251122072438)
  - public.app_users table (from 20251102034653)
  
  ============================================================================
*/

-- ============================================================================
-- TABLE: vehicle_maintenance_log
-- ============================================================================
-- Tracks all repairs, parts, and upgrades per vehicle

CREATE TABLE IF NOT EXISTS public.vehicle_maintenance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number text NOT NULL,
  maintenance_type text NOT NULL CHECK (maintenance_type IN (
    'oil_change', 'tire_rotation', 'tire_replacement', 
    'repair', 'upgrade', 'part_replacement', 'inspection', 'other'
  )),
  description text NOT NULL,
  parts_used jsonb DEFAULT '[]'::jsonb,
  mileage_at_service numeric NOT NULL,
  next_service_due_mileage numeric,
  cost numeric,
  performed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text NOT NULL,
  approved_by text,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  attachments jsonb DEFAULT '[]'::jsonb,
  warranty_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT parts_used_is_array CHECK (parts_used IS NULL OR jsonb_typeof(parts_used) = 'array'),
  CONSTRAINT attachments_is_array CHECK (attachments IS NULL OR jsonb_typeof(attachments) = 'array'),
  CONSTRAINT mileage_positive CHECK (mileage_at_service >= 0),
  CONSTRAINT cost_positive CHECK (cost IS NULL OR cost >= 0)
);

COMMENT ON TABLE public.vehicle_maintenance_log IS 
  'Tracks all maintenance activities including repairs, parts replacements, and upgrades per vehicle.';

-- ============================================================================
-- FUNCTION: normalize_truck_number()
-- ============================================================================
-- Normalizes truck numbers to uppercase and trimmed for consistency

CREATE OR REPLACE FUNCTION public.normalize_truck_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.truck_number := UPPER(TRIM(NEW.truck_number));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply normalization trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_normalize_maintenance_truck_number ON public.vehicle_maintenance_log;
CREATE TRIGGER trg_normalize_maintenance_truck_number
  BEFORE INSERT OR UPDATE ON public.vehicle_maintenance_log
  FOR EACH ROW EXECUTE FUNCTION public.normalize_truck_number();

-- ============================================================================
-- TABLE: maintenance_schedules
-- ============================================================================
-- Stores maintenance intervals and last service dates per vehicle

CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number text UNIQUE NOT NULL,
  
  -- Last service tracking
  last_oil_change_mileage numeric DEFAULT 0,
  last_oil_change_date date,
  last_tire_rotation_mileage numeric DEFAULT 0,
  last_tire_rotation_date date,
  last_tire_replacement_mileage numeric DEFAULT 0,
  last_tire_replacement_date date,
  
  -- Configurable intervals (per-truck customization)
  oil_change_interval_miles numeric NOT NULL DEFAULT 5000,
  tire_rotation_interval_miles numeric NOT NULL DEFAULT 6000,
  tire_replacement_interval_miles numeric NOT NULL DEFAULT 50000,
  
  -- Cached values for quick queries
  current_mileage numeric,
  current_mileage_date timestamptz,
  
  -- AI summary caching (Phase 2)
  ai_summary text,
  ai_summary_generated_at timestamptz,
  
  custom_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.maintenance_schedules IS 
  'Stores maintenance intervals and last service tracking per vehicle. Includes AI summary caching.';

-- Apply normalization trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_normalize_schedule_truck_number ON public.maintenance_schedules;
CREATE TRIGGER trg_normalize_schedule_truck_number
  BEFORE INSERT OR UPDATE ON public.maintenance_schedules
  FOR EACH ROW EXECUTE FUNCTION public.normalize_truck_number();

-- ============================================================================
-- TABLE: mileage_anomalies
-- ============================================================================
-- Tracks flagged odometer reading errors for review

CREATE TABLE IF NOT EXISTS public.mileage_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_number text NOT NULL,
  dvir_id uuid REFERENCES public.dvir_reports(id) ON DELETE CASCADE,
  reported_mileage numeric NOT NULL,
  previous_mileage numeric,
  expected_range_low numeric,
  expected_range_high numeric,
  anomaly_type text NOT NULL CHECK (anomaly_type IN (
    'decrease', 'large_jump', 'impossible_reading', 'stale_data'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  resolved boolean NOT NULL DEFAULT false,
  resolved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mileage_anomalies IS 
  'Tracks flagged odometer reading anomalies for mechanic review and resolution.';

-- Apply normalization trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_normalize_anomaly_truck_number ON public.mileage_anomalies;
CREATE TRIGGER trg_normalize_anomaly_truck_number
  BEFORE INSERT OR UPDATE ON public.mileage_anomalies
  FOR EACH ROW EXECUTE FUNCTION public.normalize_truck_number();

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- vehicle_maintenance_log indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_log_truck 
  ON public.vehicle_maintenance_log(truck_number);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_date 
  ON public.vehicle_maintenance_log(service_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_type 
  ON public.vehicle_maintenance_log(maintenance_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_user 
  ON public.vehicle_maintenance_log(performed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_created 
  ON public.vehicle_maintenance_log(created_at DESC);

-- maintenance_schedules indexes
CREATE INDEX IF NOT EXISTS idx_schedules_truck 
  ON public.maintenance_schedules(truck_number);
CREATE INDEX IF NOT EXISTS idx_schedules_mileage 
  ON public.maintenance_schedules(current_mileage);

-- mileage_anomalies indexes
CREATE INDEX IF NOT EXISTS idx_anomalies_truck_resolved 
  ON public.mileage_anomalies(truck_number, resolved);
CREATE INDEX IF NOT EXISTS idx_anomalies_dvir 
  ON public.mileage_anomalies(dvir_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_unresolved 
  ON public.mileage_anomalies(resolved) WHERE resolved = false;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.vehicle_maintenance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_anomalies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "maintenance_log_select" ON public.vehicle_maintenance_log;
DROP POLICY IF EXISTS "maintenance_log_insert" ON public.vehicle_maintenance_log;
DROP POLICY IF EXISTS "maintenance_log_update" ON public.vehicle_maintenance_log;
DROP POLICY IF EXISTS "maintenance_log_delete" ON public.vehicle_maintenance_log;

DROP POLICY IF EXISTS "schedules_select" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "schedules_insert" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "schedules_update" ON public.maintenance_schedules;
DROP POLICY IF EXISTS "schedules_delete" ON public.maintenance_schedules;

DROP POLICY IF EXISTS "anomalies_select" ON public.mileage_anomalies;
DROP POLICY IF EXISTS "anomalies_insert" ON public.mileage_anomalies;
DROP POLICY IF EXISTS "anomalies_update" ON public.mileage_anomalies;
DROP POLICY IF EXISTS "anomalies_delete" ON public.mileage_anomalies;

-- vehicle_maintenance_log policies
CREATE POLICY "maintenance_log_select"
  ON public.vehicle_maintenance_log FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_mechanic());

CREATE POLICY "maintenance_log_insert"
  ON public.vehicle_maintenance_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_mechanic());

CREATE POLICY "maintenance_log_update"
  ON public.vehicle_maintenance_log FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_mechanic());

CREATE POLICY "maintenance_log_delete"
  ON public.vehicle_maintenance_log FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- maintenance_schedules policies
CREATE POLICY "schedules_select"
  ON public.maintenance_schedules FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_mechanic());

CREATE POLICY "schedules_insert"
  ON public.maintenance_schedules FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_mechanic());

CREATE POLICY "schedules_update"
  ON public.maintenance_schedules FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_mechanic());

CREATE POLICY "schedules_delete"
  ON public.maintenance_schedules FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- mileage_anomalies policies
CREATE POLICY "anomalies_select"
  ON public.mileage_anomalies FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_mechanic());

CREATE POLICY "anomalies_insert"
  ON public.mileage_anomalies FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_mechanic());

CREATE POLICY "anomalies_update"
  ON public.mileage_anomalies FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_mechanic());

CREATE POLICY "anomalies_delete"
  ON public.mileage_anomalies FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- DATA SEEDING: Bootstrap maintenance_schedules from existing DVIRs
-- ============================================================================

INSERT INTO public.maintenance_schedules (truck_number, current_mileage, current_mileage_date)
SELECT DISTINCT ON (UPPER(TRIM(truck_number)))
  UPPER(TRIM(truck_number)) as truck_number,
  mileage as current_mileage,
  created_at as current_mileage_date
FROM public.dvir_reports
WHERE truck_number IS NOT NULL AND truck_number != ''
ORDER BY UPPER(TRIM(truck_number)), created_at DESC
ON CONFLICT (truck_number) DO UPDATE SET
  current_mileage = EXCLUDED.current_mileage,
  current_mileage_date = EXCLUDED.current_mileage_date,
  updated_at = now()
WHERE maintenance_schedules.current_mileage_date < EXCLUDED.current_mileage_date;

-- ============================================================================
-- FUNCTION: update_maintenance_schedule_on_log()
-- ============================================================================
-- Automatically updates maintenance_schedules when a maintenance log is created

CREATE OR REPLACE FUNCTION public.update_maintenance_schedule_on_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert the schedule for this truck
  INSERT INTO public.maintenance_schedules (truck_number)
  VALUES (NEW.truck_number)
  ON CONFLICT (truck_number) DO NOTHING;
  
  -- Update the appropriate last service fields based on maintenance type
  IF NEW.maintenance_type = 'oil_change' THEN
    UPDATE public.maintenance_schedules
    SET 
      last_oil_change_mileage = NEW.mileage_at_service,
      last_oil_change_date = NEW.service_date,
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL, -- Invalidate cached summary
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
    
  ELSIF NEW.maintenance_type = 'tire_rotation' THEN
    UPDATE public.maintenance_schedules
    SET 
      last_tire_rotation_mileage = NEW.mileage_at_service,
      last_tire_rotation_date = NEW.service_date,
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL,
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
    
  ELSIF NEW.maintenance_type = 'tire_replacement' THEN
    UPDATE public.maintenance_schedules
    SET 
      last_tire_replacement_mileage = NEW.mileage_at_service,
      last_tire_replacement_date = NEW.service_date,
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL,
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
    
  ELSE
    -- For other maintenance types, just update current mileage
    UPDATE public.maintenance_schedules
    SET 
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL,
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_schedule_on_maintenance_log ON public.vehicle_maintenance_log;
CREATE TRIGGER trg_update_schedule_on_maintenance_log
  AFTER INSERT ON public.vehicle_maintenance_log
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_schedule_on_log();

-- ============================================================================
-- FUNCTION: update_schedule_mileage_from_dvir()
-- ============================================================================
-- Updates maintenance_schedules.current_mileage when a new DVIR is submitted

CREATE OR REPLACE FUNCTION public.update_schedule_mileage_from_dvir()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if truck_number and mileage are set
  IF NEW.truck_number IS NOT NULL AND NEW.mileage IS NOT NULL THEN
    -- Upsert the schedule for this truck
    INSERT INTO public.maintenance_schedules (
      truck_number, 
      current_mileage, 
      current_mileage_date
    )
    VALUES (
      UPPER(TRIM(NEW.truck_number)), 
      NEW.mileage, 
      now()
    )
    ON CONFLICT (truck_number) DO UPDATE SET
      current_mileage = CASE 
        WHEN NEW.mileage > COALESCE(maintenance_schedules.current_mileage, 0) 
        THEN NEW.mileage 
        ELSE maintenance_schedules.current_mileage 
      END,
      current_mileage_date = CASE 
        WHEN NEW.mileage > COALESCE(maintenance_schedules.current_mileage, 0) 
        THEN now() 
        ELSE maintenance_schedules.current_mileage_date 
      END,
      ai_summary = CASE 
        WHEN NEW.mileage > COALESCE(maintenance_schedules.current_mileage, 0) 
        THEN NULL -- Invalidate cache on mileage update
        ELSE maintenance_schedules.ai_summary 
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_schedule_from_dvir ON public.dvir_reports;
CREATE TRIGGER trg_update_schedule_from_dvir
  AFTER INSERT ON public.dvir_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_schedule_mileage_from_dvir();

-- ============================================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================================
/*
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('vehicle_maintenance_log', 'maintenance_schedules', 'mileage_anomalies');

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('vehicle_maintenance_log', 'maintenance_schedules', 'mileage_anomalies');

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('vehicle_maintenance_log', 'maintenance_schedules', 'mileage_anomalies');

-- Check seeded schedules
SELECT COUNT(*) FROM maintenance_schedules;
SELECT * FROM maintenance_schedules LIMIT 10;
*/
