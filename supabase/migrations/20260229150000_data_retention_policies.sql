/*
  Data Retention Policies (Safety Compliance Audit P0)
  - Creates data_retention_policies table and seeds default rules.
  - Adds run_data_retention() function to delete records older than retention_days.
  - OSHA: DVIR 3 months; JSA/Equipment: configurable (default 1 year).
  - Schedule via pg_cron or Edge Function (e.g. daily).
*/

-- ============================================================================
-- TABLE: data_retention_policies
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL UNIQUE,
  date_column text NOT NULL,
  retention_days integer NOT NULL,
  archive_table_name text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_retention_policies IS
  'Per-table retention rules for compliance records. run_data_retention() deletes rows older than retention_days.';

-- ============================================================================
-- SEED: Default policies (OSHA DVIR 3 months; JSA/Equipment 1 year)
-- ============================================================================
INSERT INTO public.data_retention_policies (table_name, date_column, retention_days, enabled)
VALUES
  ('dvir_reports', 'report_date', 90, true),
  ('daily_jsa', 'job_date', 365, true),
  ('daily_equipment_inspections', 'inspection_date', 365, true)
ON CONFLICT (table_name) DO UPDATE SET
  date_column = EXCLUDED.date_column,
  retention_days = EXCLUDED.retention_days,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ============================================================================
-- FUNCTION: run_data_retention()
-- ============================================================================
-- Deletes rows older than retention_days for each enabled policy.
-- Uses date_column (e.g. report_date, job_date, inspection_date).
-- Call with SELECT * FROM run_data_retention(); returns deleted counts per table.
CREATE OR REPLACE FUNCTION public.run_data_retention()
RETURNS TABLE(table_name text, deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pol record;
  cutoff date;
  sql text;
  cnt bigint;
BEGIN
  FOR pol IN
    SELECT p.table_name, p.date_column, p.retention_days
    FROM public.data_retention_policies p
    WHERE p.enabled
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_name = p.table_name
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = p.table_name AND c.column_name = p.date_column
      )
  LOOP
    cutoff := (current_date AT TIME ZONE 'America/Chicago')::date - (pol.retention_days || ' days')::interval;
    sql := format(
      'DELETE FROM public.%I WHERE %I < $1',
      pol.table_name,
      pol.date_column
    );
    EXECUTE sql USING cutoff;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    table_name := pol.table_name;
    deleted_count := cnt;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.run_data_retention() IS
  'Deletes compliance records older than retention_days per data_retention_policies. Schedule daily via cron.';

-- ============================================================================
-- RLS: Only service role or admin should run retention
-- ============================================================================
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_retention_policies_admin_select" ON public.data_retention_policies;
CREATE POLICY "data_retention_policies_admin_select"
  ON public.data_retention_policies
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Service role can run run_data_retention() (SECURITY DEFINER).
