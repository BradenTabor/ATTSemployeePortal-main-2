-- =============================================================================
-- Migration: Create Work Sites Table
-- Description: GPS-enabled work sites for multi-location weather forecasting
--              in the Admin Safety Forecast feature
-- =============================================================================

-- Create work_sites table
CREATE TABLE IF NOT EXISTS public.work_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address VARCHAR(500),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  region VARCHAR(50), -- e.g., 'North Dallas', 'Fort Worth'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate sites with similar GPS coordinates (within ~11m precision)
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_sites_unique_coords 
  ON work_sites(ROUND(latitude::numeric, 4), ROUND(longitude::numeric, 4));

-- Link jobs to work sites
ALTER TABLE job_progress_trackers
ADD COLUMN IF NOT EXISTS work_site_id UUID REFERENCES work_sites(id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.work_sites ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active work sites
CREATE POLICY "Authenticated users can view active work sites"
  ON public.work_sites FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Only admins can create/update/delete work sites
CREATE POLICY "Admins can manage work sites"
  ON public.work_sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_work_sites_active 
  ON work_sites(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_work_sites_region 
  ON work_sites(region) WHERE region IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_sites_coords 
  ON work_sites(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_job_progress_work_site 
  ON job_progress_trackers(work_site_id) WHERE work_site_id IS NOT NULL;

-- =============================================================================
-- SEED FROM EXISTING USER SAVED LOCATIONS
-- Note: This seeds initial work sites from user-saved locations with GPS data
-- Sites are clustered by rounding GPS coordinates to avoid near-duplicates
-- =============================================================================

INSERT INTO work_sites (name, address, latitude, longitude)
SELECT DISTINCT ON (ROUND(latitude::numeric, 4), ROUND(longitude::numeric, 4))
  COALESCE(name, SUBSTRING(address FROM 1 FOR 100)) as name,
  address,
  latitude,
  longitude
FROM user_saved_locations
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL
  AND address IS NOT NULL
ORDER BY ROUND(latitude::numeric, 4), ROUND(longitude::numeric, 4), use_count DESC NULLS LAST
ON CONFLICT DO NOTHING;

-- =============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_work_sites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_work_sites_updated_at ON public.work_sites;
CREATE TRIGGER update_work_sites_updated_at
  BEFORE UPDATE ON public.work_sites
  FOR EACH ROW EXECUTE FUNCTION update_work_sites_updated_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.work_sites IS 'GPS-enabled work sites for weather forecasting and crew assignment tracking';
COMMENT ON COLUMN public.work_sites.region IS 'Geographic region for grouping sites (e.g., North Dallas, Fort Worth)';
COMMENT ON COLUMN public.work_sites.is_active IS 'Soft delete flag - inactive sites are hidden but preserved';
COMMENT ON COLUMN public.job_progress_trackers.work_site_id IS 'Link to work_sites for GPS-based weather forecasting';
