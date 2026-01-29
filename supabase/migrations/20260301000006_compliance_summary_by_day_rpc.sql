/*
  Compliance Summary by Day — RPC for regulator/insurer report.
  Returns daily counts of DVIR, Equipment, and JSA submissions (and distinct users).
*/

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
BEGIN
  IF p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be >= date_from';
  END IF;
  IF p_date_to - p_date_from > 366 THEN
    RAISE EXCEPTION 'Date range must not exceed 366 days';
  END IF;

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
  'Returns daily submission counts for DVIR, Equipment, and JSA. Used for Compliance Summary by Day report.';
