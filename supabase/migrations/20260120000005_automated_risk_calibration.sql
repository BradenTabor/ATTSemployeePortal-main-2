-- =============================================================================
-- Migration: Automated Risk Score Calibration System
-- Description: Zero-touch continuous improvement loop for safety risk forecasting
-- =============================================================================
--
-- This migration creates:
-- 1. risk_score_history - Stores every risk calculation for calibration analysis
-- 2. safety_incidents - Actual incidents logged by supervisors for validation
-- 3. risk_algorithm_config - Tunable multipliers with version control
-- 4. algorithm_tuning_runs - Track each auto-tuning cycle
-- 5. tuning_decisions_log - Audit trail for every tuning decision
-- 6. auto_tuning_config - System configuration (singleton)
--
-- Plus: Helper functions, RLS policies, indexes, and cron jobs
-- =============================================================================

-- =============================================================================
-- TABLE 1: risk_score_history
-- Stores every risk calculation for calibration analysis
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_for DATE NOT NULL,
  work_site_id UUID REFERENCES public.work_sites(id) ON DELETE SET NULL,
  work_site_name VARCHAR(100),
  total_score DECIMAL(3,2) NOT NULL CHECK (total_score >= 1.0 AND total_score <= 5.0),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW','MODERATE','ELEVATED','HIGH','CRITICAL')),
  weather_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  crew_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  equipment_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  temporal_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_drivers TEXT[] NOT NULL DEFAULT '{}',
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  forecast_run_id UUID REFERENCES public.compliance_runs(id) ON DELETE SET NULL,
  algorithm_version VARCHAR(10) DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_risk_score_per_date_site UNIQUE(date_for, work_site_id)
);

COMMENT ON TABLE public.risk_score_history IS 'Historical risk scores for algorithm calibration and accuracy tracking';
COMMENT ON COLUMN public.risk_score_history.top_drivers IS 'Top 3 risk contributors (text descriptions)';
COMMENT ON COLUMN public.risk_score_history.algorithm_version IS 'Version of risk_algorithm_config used for this calculation';

-- =============================================================================
-- TABLE 2: safety_incidents
-- Actual incidents logged by supervisors for validation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_date DATE NOT NULL,
  work_site_id UUID REFERENCES public.work_sites(id) ON DELETE SET NULL,
  work_site_name VARCHAR(100),
  severity TEXT NOT NULL CHECK (severity IN ('near_miss','first_aid','recordable','lost_time','fatality')),
  incident_type TEXT NOT NULL CHECK (incident_type IN ('fall','electrical','vehicle','equipment','environmental','struck_by','caught_in','other')),
  description TEXT NOT NULL,
  involved_user_ids UUID[] DEFAULT '{}',
  experience_levels TEXT[],
  weather_conditions JSONB,
  contributing_factors TEXT[] DEFAULT '{}',
  preventable BOOLEAN DEFAULT true,
  predicted_risk_score_id UUID REFERENCES public.risk_score_history(id) ON DELETE SET NULL,
  was_forecasted_high_risk BOOLEAN DEFAULT false,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.safety_incidents IS 'Actual safety incidents logged by supervisors for algorithm validation';
COMMENT ON COLUMN public.safety_incidents.predicted_risk_score_id IS 'Auto-linked to matching risk prediction for accuracy tracking';
COMMENT ON COLUMN public.safety_incidents.was_forecasted_high_risk IS 'True if the risk level was HIGH/CRITICAL/ELEVATED on incident date';

-- =============================================================================
-- TABLE 3: risk_algorithm_config
-- Tunable multipliers with version control
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.risk_algorithm_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(10) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  
  -- Weather multipliers
  wind_threshold_mph INTEGER DEFAULT 25,
  wind_multiplier_per_mph DECIMAL(4,3) DEFAULT 0.020,
  heat_index_moderate_threshold INTEGER DEFAULT 90,
  heat_index_extreme_threshold INTEGER DEFAULT 95,
  heat_moderate_multiplier DECIMAL(3,2) DEFAULT 1.15,
  heat_extreme_multiplier DECIMAL(3,2) DEFAULT 1.30,
  precipitation_moderate_multiplier DECIMAL(3,2) DEFAULT 1.10,
  precipitation_high_multiplier DECIMAL(3,2) DEFAULT 1.15,
  weather_alert_multiplier DECIMAL(3,2) DEFAULT 1.50,
  
  -- Crew multipliers
  new_hire_ratio_high_threshold DECIMAL(3,2) DEFAULT 0.50,
  new_hire_ratio_moderate_threshold DECIMAL(3,2) DEFAULT 0.30,
  new_hire_ratio_low_threshold DECIMAL(3,2) DEFAULT 0.15,
  new_hire_high_multiplier DECIMAL(3,2) DEFAULT 2.50,
  new_hire_moderate_multiplier DECIMAL(3,2) DEFAULT 1.80,
  new_hire_low_multiplier DECIMAL(3,2) DEFAULT 1.30,
  no_expert_multiplier DECIMAL(3,2) DEFAULT 1.30,
  solo_no_expert_multiplier DECIMAL(3,2) DEFAULT 1.20,
  
  -- Equipment multipliers
  critical_defect_base_multiplier DECIMAL(3,2) DEFAULT 1.00,
  critical_defect_increment DECIMAL(3,2) DEFAULT 0.20,
  warning_defect_increment DECIMAL(3,2) DEFAULT 0.05,
  
  -- Temporal multipliers
  monday_multiplier DECIMAL(3,2) DEFAULT 1.10,
  post_holiday_multiplier DECIMAL(3,2) DEFAULT 1.15,
  
  -- Risk level thresholds
  threshold_low_moderate DECIMAL(3,2) DEFAULT 1.50,
  threshold_moderate_elevated DECIMAL(3,2) DEFAULT 2.00,
  threshold_elevated_high DECIMAL(3,2) DEFAULT 2.50,
  threshold_high_critical DECIMAL(3,2) DEFAULT 3.50,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

COMMENT ON TABLE public.risk_algorithm_config IS 'Versioned configuration for risk calculation multipliers';
COMMENT ON COLUMN public.risk_algorithm_config.is_active IS 'Only one config should be active at a time';

-- Insert default v1 configuration
INSERT INTO public.risk_algorithm_config (version, is_active, notes)
VALUES ('v1', true, 'Initial baseline configuration - hardcoded defaults from calculateRiskScore.ts')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- TABLE 4: algorithm_tuning_runs
-- Track each auto-tuning cycle
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.algorithm_tuning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_version VARCHAR(10) NOT NULL,
  previous_version VARCHAR(10),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  days_elapsed INTEGER DEFAULT 0,
  total_predictions INTEGER DEFAULT 0,
  true_positives INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  false_negatives INTEGER DEFAULT 0,
  true_negatives INTEGER DEFAULT 0,
  current_accuracy DECIMAL(5,2),
  baseline_accuracy DECIMAL(5,2),
  improvement_delta DECIMAL(5,2),
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','rolled_back','failed')),
  decision_reason TEXT,
  auto_approved BOOLEAN DEFAULT false,
  triggered_by TEXT DEFAULT 'scheduled' CHECK (triggered_by IN ('auto','manual','scheduled'))
);

COMMENT ON TABLE public.algorithm_tuning_runs IS 'Audit trail for each auto-tuning execution cycle';

-- =============================================================================
-- TABLE 5: tuning_decisions_log
-- Audit trail for every tuning decision
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tuning_decisions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tuning_run_id UUID REFERENCES public.algorithm_tuning_runs(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('adjustment','activation','rollback','no_action','disabled')),
  decision_maker TEXT NOT NULL CHECK (decision_maker IN ('auto_tuner','admin','rollback_checker')),
  factor_adjusted TEXT,
  old_value DECIMAL(5,3),
  new_value DECIMAL(5,3),
  adjustment_reason TEXT,
  supporting_metrics JSONB,
  confidence_score DECIMAL(3,2),
  decision_at TIMESTAMPTZ DEFAULT now(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.tuning_decisions_log IS 'Complete audit trail of all algorithm tuning decisions';

-- =============================================================================
-- TABLE 6: auto_tuning_config
-- System configuration (singleton)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.auto_tuning_config (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  enabled BOOLEAN DEFAULT true,
  min_accuracy_threshold DECIMAL(5,2) DEFAULT 75.00,
  rollback_threshold DECIMAL(5,2) DEFAULT 10.00,
  max_multiplier_increase DECIMAL(3,2) DEFAULT 0.30,
  max_multiplier_decrease DECIMAL(3,2) DEFAULT 0.30,
  max_adjustments_per_run INTEGER DEFAULT 3,
  evaluation_period_days INTEGER DEFAULT 30,
  min_sample_size INTEGER DEFAULT 20,
  rollback_evaluation_days INTEGER DEFAULT 7,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT enforce_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);

COMMENT ON TABLE public.auto_tuning_config IS 'Singleton configuration for the auto-tuning system';

-- Insert singleton row
INSERT INTO public.auto_tuning_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- risk_score_history indexes
CREATE INDEX IF NOT EXISTS idx_risk_score_history_date 
  ON risk_score_history(date_for DESC);
CREATE INDEX IF NOT EXISTS idx_risk_score_history_date_site 
  ON risk_score_history(date_for DESC, work_site_id);
CREATE INDEX IF NOT EXISTS idx_risk_score_history_level 
  ON risk_score_history(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_score_history_version 
  ON risk_score_history(algorithm_version);

-- safety_incidents indexes
CREATE INDEX IF NOT EXISTS idx_safety_incidents_date 
  ON safety_incidents(incident_date DESC);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_severity 
  ON safety_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_site 
  ON safety_incidents(work_site_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_predicted 
  ON safety_incidents(predicted_risk_score_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_reported_by 
  ON safety_incidents(reported_by);

-- algorithm_tuning_runs indexes
CREATE INDEX IF NOT EXISTS idx_tuning_runs_status_started 
  ON algorithm_tuning_runs(status, started_at DESC);

-- tuning_decisions_log indexes
CREATE INDEX IF NOT EXISTS idx_decisions_log_decision_at 
  ON tuning_decisions_log(decision_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_log_run_id 
  ON tuning_decisions_log(tuning_run_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get the next algorithm version number
CREATE OR REPLACE FUNCTION public.get_next_algorithm_version()
RETURNS VARCHAR(10) AS $$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(version FROM 2) AS INTEGER)), 
    0
  ) INTO v_max_version
  FROM risk_algorithm_config
  WHERE version ~ '^v[0-9]+$';
  
  RETURN 'v' || (v_max_version + 1)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_next_algorithm_version() IS 'Generates sequential version numbers (v1, v2, v3...)';

-- Function to check if user can log incidents
CREATE OR REPLACE FUNCTION public.can_log_incidents()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'general_foreman', 'safety_officer', 'foreman')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.can_log_incidents() IS 'Returns true for roles that can log safety incidents';

-- Function to get active risk config
CREATE OR REPLACE FUNCTION public.get_active_risk_config()
RETURNS public.risk_algorithm_config AS $$
BEGIN
  RETURN (
    SELECT rac FROM public.risk_algorithm_config rac
    WHERE rac.is_active = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_active_risk_config() IS 'Returns the currently active risk algorithm configuration';

-- =============================================================================
-- FUNCTION: calculate_prediction_accuracy
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_prediction_accuracy(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_days INTEGER,
  high_risk_predicted INTEGER,
  incidents_occurred INTEGER,
  true_positives INTEGER,
  false_positives INTEGER,
  false_negatives INTEGER,
  true_negatives INTEGER,
  accuracy_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH risk_days AS (
    SELECT 
      rsh.date_for,
      CASE WHEN rsh.risk_level IN ('HIGH', 'CRITICAL', 'ELEVATED') 
        THEN true ELSE false 
      END as was_high_risk
    FROM risk_score_history rsh
    WHERE rsh.date_for BETWEEN p_start_date AND p_end_date
  ),
  incident_days AS (
    SELECT DISTINCT si.incident_date, true as had_incident
    FROM safety_incidents si
    WHERE si.incident_date BETWEEN p_start_date AND p_end_date
      AND si.severity IN ('recordable', 'lost_time', 'fatality')
  ),
  day_analysis AS (
    SELECT 
      rd.date_for,
      rd.was_high_risk,
      COALESCE(id.had_incident, false) as had_incident
    FROM risk_days rd
    LEFT JOIN incident_days id ON rd.date_for = id.incident_date
  )
  SELECT 
    COUNT(DISTINCT da.date_for)::INTEGER as total_days,
    COUNT(DISTINCT CASE WHEN da.was_high_risk THEN da.date_for END)::INTEGER as high_risk_predicted,
    COUNT(DISTINCT CASE WHEN da.had_incident THEN da.date_for END)::INTEGER as incidents_occurred,
    COUNT(DISTINCT CASE WHEN da.was_high_risk AND da.had_incident THEN da.date_for END)::INTEGER as true_positives,
    COUNT(DISTINCT CASE WHEN da.was_high_risk AND NOT da.had_incident THEN da.date_for END)::INTEGER as false_positives,
    COUNT(DISTINCT CASE WHEN NOT da.was_high_risk AND da.had_incident THEN da.date_for END)::INTEGER as false_negatives,
    COUNT(DISTINCT CASE WHEN NOT da.was_high_risk AND NOT da.had_incident THEN da.date_for END)::INTEGER as true_negatives,
    CASE 
      WHEN COUNT(DISTINCT da.date_for) = 0 THEN 0.00
      ELSE (
        (COUNT(DISTINCT CASE WHEN da.was_high_risk AND da.had_incident THEN da.date_for END)::DECIMAL +
         COUNT(DISTINCT CASE WHEN NOT da.was_high_risk AND NOT da.had_incident THEN da.date_for END)::DECIMAL) /
        COUNT(DISTINCT da.date_for)::DECIMAL * 100
      )
    END as accuracy_rate
  FROM day_analysis da;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_prediction_accuracy(DATE, DATE) IS 'Calculate prediction accuracy metrics for a date range';

-- =============================================================================
-- FUNCTION: calculate_factor_performance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_factor_performance(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  factor_name TEXT,
  times_triggered INTEGER,
  incidents_when_triggered INTEGER,
  false_positive_rate DECIMAL(5,2),
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH factor_analysis AS (
    SELECT 
      unnest(rsh.top_drivers) as driver_text,
      rsh.date_for,
      rsh.work_site_id,
      CASE WHEN si.id IS NOT NULL THEN true ELSE false END as had_incident
    FROM risk_score_history rsh
    LEFT JOIN safety_incidents si 
      ON rsh.date_for = si.incident_date 
      AND (rsh.work_site_id = si.work_site_id OR (rsh.work_site_id IS NULL AND si.work_site_id IS NULL))
      AND si.severity IN ('recordable', 'lost_time', 'fatality')
    WHERE rsh.date_for BETWEEN p_start_date AND p_end_date
      AND rsh.risk_level IN ('HIGH', 'CRITICAL', 'ELEVATED')
  )
  SELECT 
    fa.driver_text as factor_name,
    COUNT(*)::INTEGER as times_triggered,
    COUNT(*) FILTER (WHERE fa.had_incident)::INTEGER as incidents_when_triggered,
    CASE 
      WHEN COUNT(*) = 0 THEN 0.00
      ELSE (COUNT(*) FILTER (WHERE NOT fa.had_incident)::DECIMAL / COUNT(*) * 100)
    END as false_positive_rate,
    CASE
      -- If FP rate > 70%, factor is crying wolf too often -> decrease multiplier
      WHEN COUNT(*) FILTER (WHERE NOT fa.had_incident)::DECIMAL / NULLIF(COUNT(*), 0) > 0.70 THEN 'decrease'
      -- If usually correct when triggered -> maintain
      WHEN COUNT(*) FILTER (WHERE fa.had_incident)::DECIMAL / NULLIF(COUNT(*), 0) > 0.30 THEN 'maintain'
      -- Default maintain
      ELSE 'maintain'
    END as recommendation
  FROM factor_analysis fa
  GROUP BY fa.driver_text
  HAVING COUNT(*) >= 3 -- Only factors triggered 3+ times
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_factor_performance(DATE, DATE) IS 'Analyze which risk factors are over/under-predicting';

-- =============================================================================
-- FUNCTION: auto_tune_algorithm
-- =============================================================================

CREATE OR REPLACE FUNCTION public.auto_tune_algorithm()
RETURNS TABLE (
  action_taken TEXT,
  new_config_version TEXT,
  adjustments_made JSONB,
  accuracy_before DECIMAL(5,2),
  factors_analyzed INTEGER
) AS $$
DECLARE
  v_config RECORD;
  v_current_version TEXT;
  v_latest_accuracy DECIMAL(5,2);
  v_new_version TEXT;
  v_adjustments JSONB := '[]'::jsonb;
  v_factor_count INTEGER := 0;
  v_factor_perf RECORD;
BEGIN
  -- Step 1: Check if enabled
  SELECT * INTO v_config FROM auto_tuning_config LIMIT 1;
  IF NOT v_config.enabled THEN
    RETURN QUERY SELECT 
      'disabled'::TEXT, 
      NULL::TEXT, 
      NULL::JSONB,
      NULL::DECIMAL(5,2),
      0;
    RETURN;
  END IF;
  
  -- Step 2: Get current version
  SELECT version INTO v_current_version 
  FROM risk_algorithm_config 
  WHERE is_active = true;
  
  -- Step 3: Calculate accuracy
  SELECT pa.accuracy_rate INTO v_latest_accuracy
  FROM calculate_prediction_accuracy(
    CURRENT_DATE - v_config.evaluation_period_days,
    CURRENT_DATE
  ) pa;
  
  -- Handle NULL (no data)
  IF v_latest_accuracy IS NULL THEN
    RETURN QUERY SELECT 
      'insufficient_data'::TEXT, 
      v_current_version, 
      NULL::JSONB,
      NULL::DECIMAL(5,2),
      0;
    RETURN;
  END IF;
  
  -- Step 4: Check threshold
  IF v_latest_accuracy >= v_config.min_accuracy_threshold THEN
    RETURN QUERY SELECT 
      'no_action_needed'::TEXT, 
      v_current_version, 
      NULL::JSONB,
      v_latest_accuracy,
      0;
    RETURN;
  END IF;
  
  -- Step 5: Get recommendations (max adjustments per run)
  FOR v_factor_perf IN 
    SELECT * FROM calculate_factor_performance(
      CURRENT_DATE - v_config.evaluation_period_days,
      CURRENT_DATE
    )
    WHERE recommendation != 'maintain'
    LIMIT v_config.max_adjustments_per_run
  LOOP
    v_adjustments := v_adjustments || jsonb_build_object(
      'factor', v_factor_perf.factor_name,
      'recommendation', v_factor_perf.recommendation,
      'false_positive_rate', v_factor_perf.false_positive_rate,
      'times_triggered', v_factor_perf.times_triggered
    );
    v_factor_count := v_factor_count + 1;
  END LOOP;
  
  -- Step 6: If no adjustments identified
  IF v_factor_count = 0 THEN
    RETURN QUERY SELECT 
      'no_adjustments_identified'::TEXT, 
      v_current_version, 
      NULL::JSONB,
      v_latest_accuracy,
      0;
    RETURN;
  END IF;
  
  -- Step 7: Generate new version
  v_new_version := get_next_algorithm_version();
  
  -- Step 8: Return for Edge Function to handle actual config creation/activation
  RETURN QUERY SELECT 
    'adjustments_recommended'::TEXT,
    v_new_version,
    v_adjustments,
    v_latest_accuracy,
    v_factor_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_tune_algorithm() IS 'Main auto-tuning logic - analyzes accuracy and recommends adjustments';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at trigger for safety_incidents
DROP TRIGGER IF EXISTS trigger_safety_incidents_updated_at ON public.safety_incidents;
CREATE TRIGGER trigger_safety_incidents_updated_at
  BEFORE UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_algorithm_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.algorithm_tuning_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuning_decisions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_tuning_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- risk_score_history: Admins can view
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "risk_score_history_admin_select" ON risk_score_history;
CREATE POLICY "risk_score_history_admin_select"
  ON risk_score_history FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Service role can insert (for edge functions)
DROP POLICY IF EXISTS "risk_score_history_service_insert" ON risk_score_history;
CREATE POLICY "risk_score_history_service_insert"
  ON risk_score_history FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- safety_incidents: Reporters can insert, view own, admins see all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "safety_incidents_reporters_insert" ON safety_incidents;
CREATE POLICY "safety_incidents_reporters_insert"
  ON safety_incidents FOR INSERT
  TO authenticated
  WITH CHECK (public.can_log_incidents());

DROP POLICY IF EXISTS "safety_incidents_own_select" ON safety_incidents;
CREATE POLICY "safety_incidents_own_select"
  ON safety_incidents FOR SELECT
  TO authenticated
  USING (reported_by = auth.uid());

DROP POLICY IF EXISTS "safety_incidents_admin_all" ON safety_incidents;
CREATE POLICY "safety_incidents_admin_all"
  ON safety_incidents FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- risk_algorithm_config: Admins only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "risk_algorithm_config_admin_select" ON risk_algorithm_config;
CREATE POLICY "risk_algorithm_config_admin_select"
  ON risk_algorithm_config FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "risk_algorithm_config_service_all" ON risk_algorithm_config;
CREATE POLICY "risk_algorithm_config_service_all"
  ON risk_algorithm_config FOR ALL
  TO service_role
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- algorithm_tuning_runs: Admins can view, service role can write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tuning_runs_admin_select" ON algorithm_tuning_runs;
CREATE POLICY "tuning_runs_admin_select"
  ON algorithm_tuning_runs FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "tuning_runs_service_all" ON algorithm_tuning_runs;
CREATE POLICY "tuning_runs_service_all"
  ON algorithm_tuning_runs FOR ALL
  TO service_role
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- tuning_decisions_log: Admins can view, service role can write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "decisions_log_admin_select" ON tuning_decisions_log;
CREATE POLICY "decisions_log_admin_select"
  ON tuning_decisions_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "decisions_log_service_all" ON tuning_decisions_log;
CREATE POLICY "decisions_log_service_all"
  ON tuning_decisions_log FOR ALL
  TO service_role
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- auto_tuning_config: Admins can view/update, service role can write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "auto_tuning_config_admin_select" ON auto_tuning_config;
CREATE POLICY "auto_tuning_config_admin_select"
  ON auto_tuning_config FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "auto_tuning_config_admin_update" ON auto_tuning_config;
CREATE POLICY "auto_tuning_config_admin_update"
  ON auto_tuning_config FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "auto_tuning_config_service_all" ON auto_tuning_config;
CREATE POLICY "auto_tuning_config_service_all"
  ON auto_tuning_config FOR ALL
  TO service_role
  WITH CHECK (true);

-- =============================================================================
-- GRANT FUNCTION PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_next_algorithm_version() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_log_incidents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_risk_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prediction_accuracy(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_factor_performance(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_tune_algorithm() TO service_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
