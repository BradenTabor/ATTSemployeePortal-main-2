-- =============================================================================
-- Smart Form Defaults: Database Indexes
-- =============================================================================
-- Purpose: Optimize queries for smart defaults feature
-- These indexes enable efficient lookups of user submission history
-- sorted by recency (created_at DESC) for the candidate extraction logic.
-- =============================================================================

-- Index for fast DVIR history lookup by user
-- Used by: getSmartDefaultsCandidates.ts, get-smart-defaults Edge Function
CREATE INDEX IF NOT EXISTS idx_dvir_user_created 
ON dvir_reports(user_id, created_at DESC);

-- Index for fast JSA history lookup by user
-- Used by: getSmartDefaultsCandidates.ts, get-smart-defaults Edge Function
CREATE INDEX IF NOT EXISTS idx_jsa_user_created 
ON daily_jsa(user_id, created_at DESC);

-- Add comments for documentation
COMMENT ON INDEX idx_dvir_user_created IS 'Smart defaults: fast user DVIR history lookup (user_id + created_at DESC)';
COMMENT ON INDEX idx_jsa_user_created IS 'Smart defaults: fast user JSA history lookup (user_id + created_at DESC)';
