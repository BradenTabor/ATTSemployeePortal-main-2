-- =============================================================================
-- Migration: Create Compliance Rewards Table
-- Description: Gamified compliance points for form completion
--              Configurable points via JSONB for A/B testing
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.compliance_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date_for DATE NOT NULL,
  forms_completed TEXT[] NOT NULL, -- ['dvir', 'equipment', 'jsa']
  points_awarded INTEGER NOT NULL DEFAULT 5,
  -- Configurable points for A/B testing without schema changes
  points_config JSONB DEFAULT '{"full_compliance": 5, "partial": 2, "streak_bonus": 10}'::jsonb,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate awards for same user/date
  UNIQUE(user_id, date_for)
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.compliance_rewards ENABLE ROW LEVEL SECURITY;

-- Users can view their own rewards
CREATE POLICY "Users can view own rewards"
  ON public.compliance_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all rewards
CREATE POLICY "Admins can view all rewards"
  ON public.compliance_rewards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only service role can insert/update (via Edge Functions)
CREATE POLICY "Service role can manage rewards"
  ON public.compliance_rewards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_compliance_rewards_user_id 
  ON compliance_rewards(user_id);

CREATE INDEX IF NOT EXISTS idx_compliance_rewards_date 
  ON compliance_rewards(date_for);

CREATE INDEX IF NOT EXISTS idx_compliance_rewards_user_date 
  ON compliance_rewards(user_id, date_for);

-- Index for leaderboard queries (points sum by user)
CREATE INDEX IF NOT EXISTS idx_compliance_rewards_points 
  ON compliance_rewards(user_id, points_awarded);

-- =============================================================================
-- FUNCTION: Calculate user's total compliance points
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_compliance_points(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_points BIGINT,
  total_days INTEGER,
  full_compliance_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(points_awarded), 0)::BIGINT as total_points,
    COUNT(*)::INTEGER as total_days,
    COUNT(*) FILTER (WHERE array_length(forms_completed, 1) = 3)::INTEGER as full_compliance_days
  FROM public.compliance_rewards
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR date_for >= p_start_date)
    AND (p_end_date IS NULL OR date_for <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get compliance leaderboard
-- =============================================================================

CREATE OR REPLACE FUNCTION get_compliance_leaderboard(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role TEXT,
  total_points BIGINT,
  total_days INTEGER,
  full_compliance_days INTEGER,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH user_points AS (
    SELECT
      cr.user_id,
      au.full_name,
      au.role,
      SUM(cr.points_awarded) as total_points,
      COUNT(*) as total_days,
      COUNT(*) FILTER (WHERE array_length(cr.forms_completed, 1) = 3) as full_compliance_days
    FROM public.compliance_rewards cr
    JOIN public.app_users au ON cr.user_id = au.user_id
    WHERE (p_start_date IS NULL OR cr.date_for >= p_start_date)
      AND (p_end_date IS NULL OR cr.date_for <= p_end_date)
    GROUP BY cr.user_id, au.full_name, au.role
  )
  SELECT
    up.user_id,
    up.full_name,
    up.role,
    up.total_points::BIGINT,
    up.total_days::INTEGER,
    up.full_compliance_days::INTEGER,
    ROW_NUMBER() OVER (ORDER BY up.total_points DESC)::INTEGER as rank
  FROM user_points up
  ORDER BY up.total_points DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.compliance_rewards IS 'Gamified compliance points awarded for daily form completion. Part of the Safety Points system.';
COMMENT ON COLUMN public.compliance_rewards.forms_completed IS 'Array of form types completed: dvir, equipment, jsa';
COMMENT ON COLUMN public.compliance_rewards.points_config IS 'Configurable point values for A/B testing: full_compliance (5), partial (2), streak_bonus (10)';
COMMENT ON FUNCTION get_user_compliance_points IS 'Returns total compliance points for a user within optional date range';
COMMENT ON FUNCTION get_compliance_leaderboard IS 'Returns top users by compliance points for leaderboard display';
