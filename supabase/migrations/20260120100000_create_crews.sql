-- =============================================================================
-- Migration: Create Crews System
-- Description: Named persistent crews for team management
--              Enables assigning teams to work sites and jobs
-- =============================================================================

-- =============================================================================
-- TABLE: crews
-- Named persistent crews (e.g., "Crew A", "North Team")
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unique constraint on name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crews_name_unique 
  ON public.crews(LOWER(name));

-- Index for active crews
CREATE INDEX IF NOT EXISTS idx_crews_active 
  ON public.crews(is_active) WHERE is_active = true;

COMMENT ON TABLE public.crews IS 'Named persistent crews for team management';
COMMENT ON COLUMN public.crews.name IS 'Unique crew name (e.g., Crew A, North Team)';
COMMENT ON COLUMN public.crews.is_active IS 'Soft delete flag - inactive crews are hidden but preserved';

-- =============================================================================
-- TABLE: crew_members
-- Links users to crews (many-to-many)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(crew_id, user_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id 
  ON public.crew_members(crew_id);

CREATE INDEX IF NOT EXISTS idx_crew_members_user_id 
  ON public.crew_members(user_id);

COMMENT ON TABLE public.crew_members IS 'Maps users to crews they belong to';

-- =============================================================================
-- ALTER: Add crew_id to work_sites
-- Default crew assigned to a work site
-- =============================================================================

ALTER TABLE public.work_sites 
  ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_sites_crew_id 
  ON public.work_sites(crew_id) WHERE crew_id IS NOT NULL;

COMMENT ON COLUMN public.work_sites.crew_id IS 'Default crew assigned to this work site';

-- =============================================================================
-- ALTER: Add crew_id to job_progress_trackers
-- Crew assigned to a job (can override individual assignments)
-- =============================================================================

ALTER TABLE public.job_progress_trackers 
  ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_crew_id 
  ON public.job_progress_trackers(crew_id) WHERE crew_id IS NOT NULL;

COMMENT ON COLUMN public.job_progress_trackers.crew_id IS 'Crew assigned to this job';

-- =============================================================================
-- ROW LEVEL SECURITY: crews
-- =============================================================================

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active crews
CREATE POLICY "Authenticated users can view active crews"
  ON public.crews FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Admins can manage all crews
CREATE POLICY "Admins can manage crews"
  ON public.crews FOR ALL
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
-- ROW LEVEL SECURITY: crew_members
-- =============================================================================

ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view crew memberships
CREATE POLICY "Authenticated users can view crew members"
  ON public.crew_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admins can manage crew memberships
CREATE POLICY "Admins can manage crew members"
  ON public.crew_members FOR ALL
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
-- TRIGGER: Auto-update updated_at timestamp for crews
-- =============================================================================

CREATE OR REPLACE FUNCTION update_crews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_crews_updated_at ON public.crews;
CREATE TRIGGER update_crews_updated_at
  BEFORE UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION update_crews_updated_at();

-- =============================================================================
-- VIEW: crew_with_members (for easy querying)
-- =============================================================================

CREATE OR REPLACE VIEW public.crew_with_member_count AS
SELECT 
  c.id,
  c.name,
  c.description,
  c.is_active,
  c.created_at,
  c.updated_at,
  c.created_by,
  COUNT(cm.id) as member_count
FROM public.crews c
LEFT JOIN public.crew_members cm ON c.id = cm.crew_id
GROUP BY c.id, c.name, c.description, c.is_active, c.created_at, c.updated_at, c.created_by;

COMMENT ON VIEW public.crew_with_member_count IS 'Crews with their member counts';

-- =============================================================================
-- ENABLE REALTIME
-- =============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crews;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_members;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
