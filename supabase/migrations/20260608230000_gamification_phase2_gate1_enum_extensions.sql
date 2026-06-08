-- =============================================================================
-- Gamification Phase 2 — Gate 1 (step 1): enum extensions only
-- D2: ADD VALUE must commit before any function references the new labels.
-- Applied as its own migration file so local gate / MCP apply each commit separately.
-- =============================================================================

ALTER TYPE public.point_source ADD VALUE IF NOT EXISTS 'challenge_reward';
ALTER TYPE public.point_source ADD VALUE IF NOT EXISTS 'campaign_multiplier_bonus';

ALTER TYPE public.recognition_event_type ADD VALUE IF NOT EXISTS 'season_podium';
ALTER TYPE public.recognition_event_type ADD VALUE IF NOT EXISTS 'season_most_improved';
