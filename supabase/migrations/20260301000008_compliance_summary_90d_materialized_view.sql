/*
  Compliance Summary 90d — Materialized view for fast "Compliance Summary by Day" report.
  Precomputes daily DVIR, Equipment, and JSA counts (and distinct users) for the last 90 days.
  Refresh nightly via pg_cron (2 AM UTC). get_compliance_summary_by_day uses this MV when
  the requested range is within the last 90 days for sub-60s response.
*/

-- =============================================================================
-- MATERIALIZED VIEW: compliance_summary_90d
-- =============================================================================
-- Same shape as get_compliance_summary_by_day: one row per day with counts.
-- Definition uses CURRENT_DATE so each REFRESH recomputes the rolling 90-day window.

DROP MATERIALIZED VIEW IF EXISTS public.compliance_summary_90d;

CREATE MATERIALIZED VIEW public.compliance_summary_90d AS
SELECT
  d::date AS date,
  (SELECT count(*) FROM public.dvir_reports WHERE report_date = d::date) AS dvir_count,
  (SELECT count(DISTINCT user_id) FROM public.dvir_reports WHERE report_date = d::date) AS dvir_users,
  (SELECT count(*) FROM public.daily_equipment_inspections WHERE inspection_date = d::date) AS equipment_count,
  (SELECT count(DISTINCT user_id) FROM public.daily_equipment_inspections WHERE inspection_date = d::date) AS equipment_users,
  (SELECT count(*) FROM public.daily_jsa WHERE job_date = d::date) AS jsa_count,
  (SELECT count(DISTINCT user_id) FROM public.daily_jsa WHERE job_date = d::date) AS jsa_users
FROM generate_series(
  CURRENT_DATE - INTERVAL '90 days',
  CURRENT_DATE,
  '1 day'::interval
) AS d;

CREATE UNIQUE INDEX idx_compliance_summary_90d_date
  ON public.compliance_summary_90d (date);

COMMENT ON MATERIALIZED VIEW public.compliance_summary_90d IS
  'Precomputed daily DVIR/Equipment/JSA counts for last 90 days. Refresh nightly for fast report.';

-- =============================================================================
-- RPC: Use MV when range is within last 90 days
-- =============================================================================
-- get_compliance_summary_by_day: if request is within (CURRENT_DATE - 90, CURRENT_DATE)
-- and range <= 90 days, return from MV; else use existing loop (for larger or older ranges).

CREATE OR REPLACE FUNCTION public.get_compliance_summary_by_day(
  p_date_from date,
  p_date_to date
)
RETURNS TABLE(
  date date,
  dvir_count bigint,
  dvir_users bigint,
  equipment_count bigint,
  equipment_users bigint,
  jsa_count bigint,
  jsa_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  d date;
  v_dvir_count bigint;
  v_dvir_users bigint;
  v_equipment_count bigint;
  v_equipment_users bigint;
  v_jsa_count bigint;
  v_jsa_users bigint;
  mv_min date := CURRENT_DATE - INTERVAL '90 days';
BEGIN
  IF p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be >= date_from';
  END IF;
  IF p_date_to - p_date_from > 366 THEN
    RAISE EXCEPTION 'Date range must not exceed 366 days';
  END IF;

  -- Fast path: requested range is entirely within the MV window (last 90 days)
  IF p_date_from >= mv_min AND p_date_to <= CURRENT_DATE AND (p_date_to - p_date_from + 1) <= 91 THEN
    RETURN QUERY
    SELECT
      m.date,
      m.dvir_count,
      m.dvir_users,
      m.equipment_count,
      m.equipment_users,
      m.jsa_count,
      m.jsa_users
    FROM public.compliance_summary_90d m
    WHERE m.date >= p_date_from AND m.date <= p_date_to
    ORDER BY m.date;
    RETURN;
  END IF;

  -- Slow path: loop (e.g. range > 90 days or dates older than 90 days)
  FOR d IN
    SELECT generate_series(p_date_from, p_date_to, '1 day'::interval)::date
  LOOP
    SELECT count(*), count(DISTINCT user_id)
      INTO v_dvir_count, v_dvir_users
      FROM dvir_reports
      WHERE report_date = d;

    SELECT count(*), count(DISTINCT user_id)
      INTO v_equipment_count, v_equipment_users
      FROM daily_equipment_inspections
      WHERE inspection_date = d;

    SELECT count(*), count(DISTINCT user_id)
      INTO v_jsa_count, v_jsa_users
      FROM daily_jsa
      WHERE job_date = d;

    date := d;
    dvir_count := coalesce(v_dvir_count, 0);
    dvir_users := coalesce(v_dvir_users, 0);
    equipment_count := coalesce(v_equipment_count, 0);
    equipment_users := coalesce(v_equipment_users, 0);
    jsa_count := coalesce(v_jsa_count, 0);
    jsa_users := coalesce(v_jsa_users, 0);
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_compliance_summary_by_day(date, date) IS
  'Returns daily submission counts for DVIR, Equipment, and JSA. Uses compliance_summary_90d when range within last 90 days.';

-- =============================================================================
-- SCHEDULE: Nightly refresh (2 AM UTC)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-compliance-summary-90d');
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-compliance-summary-90d',
      '0 2 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.compliance_summary_90d'
    );
    RAISE NOTICE 'Scheduled refresh-compliance-summary-90d (daily 02:00 UTC)';
  ELSE
    RAISE NOTICE 'pg_cron not available, skipping compliance_summary_90d refresh schedule';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not schedule refresh-compliance-summary-90d: %', SQLERRM;
END
$$;
