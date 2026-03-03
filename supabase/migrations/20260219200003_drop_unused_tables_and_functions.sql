-- ============================================================================
-- Phase 4: Drop unused tables and functions
-- Tables: user_hazard_presets, user_jsa_templates (zero app code references)
-- Functions: get_active_risk_config(), auto_tune_algorithm() (superseded by Edge Functions)
-- ============================================================================

DROP TABLE IF EXISTS public.user_hazard_presets;
DROP TABLE IF EXISTS public.user_jsa_templates;

DROP FUNCTION IF EXISTS public.get_active_risk_config();
DROP FUNCTION IF EXISTS public.auto_tune_algorithm();
