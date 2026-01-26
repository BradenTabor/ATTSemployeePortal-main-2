-- =============================================================================
-- Certification Analytics — Materialized Views
-- =============================================================================
-- Refresh daily via pg_cron (03:00 UTC). Admin UI reads these.
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS public.certification_completion_stats;
CREATE MATERIALIZED VIEW public.certification_completion_stats AS
SELECT
  ct.id AS certification_type_id,
  ct.name AS certification_name,
  COUNT(DISTINCT ca.user_id) FILTER (WHERE ca.status = 'graded') AS total_attempts,
  COUNT(DISTINCT ca.user_id) FILTER (WHERE ca.status = 'graded' AND ca.passed) AS passed_users,
  ROUND(AVG(ca.score_percentage) FILTER (WHERE ca.status = 'graded' AND ca.passed)::numeric, 2) AS avg_passing_score,
  ROUND(AVG(ca.attempt_number) FILTER (WHERE ca.status = 'graded' AND ca.passed)::numeric, 2) AS avg_attempts_to_pass
FROM public.certification_types ct
LEFT JOIN public.certification_attempts ca ON ct.id = ca.certification_type_id
WHERE ct.is_active = true
GROUP BY ct.id, ct.name;

CREATE UNIQUE INDEX ON public.certification_completion_stats (certification_type_id);

COMMENT ON MATERIALIZED VIEW public.certification_completion_stats IS
  'Per-cert completion stats. Refresh daily for admin dashboard.';

DROP MATERIALIZED VIEW IF EXISTS public.user_certification_matrix;
CREATE MATERIALIZED VIEW public.user_certification_matrix AS
SELECT
  u.user_id,
  u.full_name,
  u.role,
  ct.id AS certification_type_id,
  ct.name AS certification_name,
  cr.status,
  cr.expires_at,
  CASE
    WHEN cr.status = 'active' AND cr.expires_at > now() THEN 'compliant'
    WHEN cr.status = 'active' AND cr.expires_at <= now() + INTERVAL '30 days' THEN 'expiring_soon'
    ELSE 'non_compliant'
  END AS compliance_status
FROM public.app_users u
CROSS JOIN public.certification_types ct
LEFT JOIN public.certification_records cr
  ON cr.user_id = u.user_id AND cr.certification_type_id = ct.id
WHERE ct.is_active = true
  AND u.role IN ('employee', 'foreman', 'mechanic', 'general_foreman', 'safety_officer', 'manager');

CREATE UNIQUE INDEX ON public.user_certification_matrix (user_id, certification_type_id);
CREATE INDEX ON public.user_certification_matrix (certification_type_id);
CREATE INDEX ON public.user_certification_matrix (compliance_status);

COMMENT ON MATERIALIZED VIEW public.user_certification_matrix IS
  'User × cert compliance. Refresh daily.';

-- Refresh job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-cert-analytics');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-cert-analytics',
      '0 3 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.certification_completion_stats; REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_certification_matrix'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available or schedule failed: %', SQLERRM;
END $$;

-- RPCs for admin UI (SECURITY DEFINER, admin-only)
CREATE OR REPLACE FUNCTION public.get_certification_completion_stats()
RETURNS SETOF public.certification_completion_stats
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.certification_completion_stats
  WHERE EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_certification_matrix(
  p_cert_type_id UUID DEFAULT NULL,
  p_compliance_status TEXT DEFAULT NULL
)
RETURNS SETOF public.user_certification_matrix
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.user_certification_matrix m
  WHERE EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
  )
  AND (p_cert_type_id IS NULL OR m.certification_type_id = p_cert_type_id)
  AND (p_compliance_status IS NULL OR m.compliance_status = p_compliance_status);
$$;

GRANT EXECUTE ON FUNCTION public.get_certification_completion_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_certification_matrix(UUID, TEXT) TO authenticated;
