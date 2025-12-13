-- ============================================================================
-- Job Progress Tracker - Database Migration
-- ============================================================================
-- Creates tables for job tracking with milestones and crew assignments
-- Includes RLS policies and realtime subscriptions
-- ============================================================================

-- ============================================================================
-- TABLE: job_progress_trackers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_progress_trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    job_name TEXT NOT NULL,
    job_location TEXT,
    job_description TEXT,
    job_specs TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    notes TEXT
);

-- Add comment for documentation
COMMENT ON TABLE public.job_progress_trackers IS 'Tracks job progress with timelines for the employee portal';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_status ON public.job_progress_trackers(status);
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_created_by ON public.job_progress_trackers(created_by);
CREATE INDEX IF NOT EXISTS idx_job_progress_trackers_dates ON public.job_progress_trackers(start_date, end_date);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_job_progress_trackers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_job_progress_trackers_updated_at ON public.job_progress_trackers;
CREATE TRIGGER trigger_update_job_progress_trackers_updated_at
    BEFORE UPDATE ON public.job_progress_trackers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_job_progress_trackers_updated_at();

-- ============================================================================
-- TABLE: job_milestones
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.job_progress_trackers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.job_milestones IS 'Milestones/checkpoints within a job';

CREATE INDEX IF NOT EXISTS idx_job_milestones_job_id ON public.job_milestones(job_id);
CREATE INDEX IF NOT EXISTS idx_job_milestones_sort_order ON public.job_milestones(job_id, sort_order);

-- ============================================================================
-- TABLE: job_crew_assignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_crew_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.job_progress_trackers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    UNIQUE(job_id, user_id)
);

COMMENT ON TABLE public.job_crew_assignments IS 'Maps users to jobs they are assigned to work on';

CREATE INDEX IF NOT EXISTS idx_job_crew_assignments_job_id ON public.job_crew_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_crew_assignments_user_id ON public.job_crew_assignments(user_id);

-- ============================================================================
-- RLS POLICIES: job_progress_trackers
-- ============================================================================
ALTER TABLE public.job_progress_trackers ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins have full access to job_progress_trackers" ON public.job_progress_trackers;
CREATE POLICY "Admins have full access to job_progress_trackers"
    ON public.job_progress_trackers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.user_id = auth.uid()
            AND app_users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.user_id = auth.uid()
            AND app_users.role = 'admin'
        )
    );

-- Users can read jobs they are assigned to
DROP POLICY IF EXISTS "Users can read assigned jobs" ON public.job_progress_trackers;
CREATE POLICY "Users can read assigned jobs"
    ON public.job_progress_trackers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.job_crew_assignments
            WHERE job_crew_assignments.job_id = job_progress_trackers.id
            AND job_crew_assignments.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS POLICIES: job_milestones
-- ============================================================================
ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins have full access to job_milestones" ON public.job_milestones;
CREATE POLICY "Admins have full access to job_milestones"
    ON public.job_milestones
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.user_id = auth.uid()
            AND app_users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.user_id = auth.uid()
            AND app_users.role = 'admin'
        )
    );

-- Users can read milestones for jobs they are assigned to
DROP POLICY IF EXISTS "Users can read milestones for assigned jobs" ON public.job_milestones;
CREATE POLICY "Users can read milestones for assigned jobs"
    ON public.job_milestones
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.job_crew_assignments
            WHERE job_crew_assignments.job_id = job_milestones.job_id
            AND job_crew_assignments.user_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS POLICIES: job_crew_assignments
-- ============================================================================
ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
DROP POLICY IF EXISTS "Admins have full access to job_crew_assignments" ON public.job_crew_assignments;
CREATE POLICY "Admins have full access to job_crew_assignments"
    ON public.job_crew_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.user_id = auth.uid()
            AND app_users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users
            WHERE app_users.user_id = auth.uid()
            AND app_users.role = 'admin'
        )
    );

-- Users can read their own assignments
DROP POLICY IF EXISTS "Users can read own crew assignments" ON public.job_crew_assignments;
CREATE POLICY "Users can read own crew assignments"
    ON public.job_crew_assignments
    FOR SELECT
    USING (user_id = auth.uid());

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_progress_trackers;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_milestones;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_crew_assignments;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- OPTIONAL: Server-side progress calculation function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_job_progress(p_job_id UUID)
RETURNS JSON AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_today DATE := CURRENT_DATE;
    v_total_days INTEGER;
    v_elapsed_days INTEGER;
    v_percentage INTEGER;
    v_status TEXT;
    v_days_exceeded INTEGER;
    v_days_remaining INTEGER;
BEGIN
    SELECT start_date, end_date INTO v_start_date, v_end_date
    FROM public.job_progress_trackers
    WHERE id = p_job_id;
    
    IF v_start_date IS NULL THEN
        RETURN json_build_object(
            'percentage', 0,
            'status', 'not_found',
            'daysExceeded', 0,
            'daysRemaining', 0,
            'totalDays', 0,
            'elapsedDays', 0
        );
    END IF;
    
    v_total_days := GREATEST(1, (v_end_date - v_start_date) + 1);
    
    -- Job hasn't started yet
    IF v_today < v_start_date THEN
        RETURN json_build_object(
            'percentage', 0,
            'status', 'not_started',
            'daysExceeded', 0,
            'daysRemaining', (v_start_date - v_today),
            'totalDays', v_total_days,
            'elapsedDays', 0
        );
    END IF;
    
    -- Job timeline has been exceeded
    IF v_today > v_end_date THEN
        v_days_exceeded := (v_today - v_end_date);
        RETURN json_build_object(
            'percentage', 100,
            'status', 'exceeded',
            'daysExceeded', v_days_exceeded,
            'daysRemaining', 0,
            'totalDays', v_total_days,
            'elapsedDays', v_total_days + v_days_exceeded
        );
    END IF;
    
    -- Job is exactly on end date
    IF v_today = v_end_date THEN
        RETURN json_build_object(
            'percentage', 100,
            'status', 'completed',
            'daysExceeded', 0,
            'daysRemaining', 0,
            'totalDays', v_total_days,
            'elapsedDays', v_total_days
        );
    END IF;
    
    -- Job is in progress
    v_elapsed_days := (v_today - v_start_date) + 1;
    v_days_remaining := (v_end_date - v_today);
    v_percentage := LEAST(100, GREATEST(0, ROUND((v_elapsed_days::FLOAT / v_total_days::FLOAT) * 100)));
    
    RETURN json_build_object(
        'percentage', v_percentage,
        'status', 'in_progress',
        'daysExceeded', 0,
        'daysRemaining', v_days_remaining,
        'totalDays', v_total_days,
        'elapsedDays', v_elapsed_days
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_job_progress IS 'Calculates job progress based on dates - useful for server-side queries';

