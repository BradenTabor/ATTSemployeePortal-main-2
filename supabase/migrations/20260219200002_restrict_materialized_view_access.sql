-- ============================================================================
-- Phase 3: Revoke anon SELECT on 4 materialized views
-- App uses these only via authenticated API (admin/safety officer pages).
-- ============================================================================

REVOKE SELECT ON public.asset_cost_summary FROM anon;
REVOKE SELECT ON public.certification_completion_stats FROM anon;
REVOKE SELECT ON public.compliance_summary_90d FROM anon;
REVOKE SELECT ON public.user_certification_matrix FROM anon;
