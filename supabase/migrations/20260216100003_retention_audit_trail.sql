-- Audit trail for data retention: log to safety_audit_log before each DELETE batch.
-- Optional archive: when archive_table_name is set, INSERT into archive then DELETE.

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
  oldest_record_date date;
  newest_deleted_date date;
  archive_sql text;
BEGIN
  FOR pol IN
    SELECT p.table_name, p.date_column, p.retention_days, p.archive_table_name
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

    -- Get count and date range of rows that will be deleted
    EXECUTE format(
      'SELECT count(*)::bigint, min(%I)::date, max(%I)::date FROM public.%I WHERE %I < $1',
      pol.date_column, pol.date_column, pol.table_name, pol.date_column
    ) INTO cnt, oldest_record_date, newest_deleted_date USING cutoff;

    IF cnt IS NULL OR cnt = 0 THEN
      table_name := pol.table_name;
      deleted_count := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Log to safety_audit_log BEFORE deleting
    INSERT INTO public.safety_audit_log (event_type, table_name, payload_snapshot)
    VALUES (
      'data_retention_delete',
      pol.table_name,
      jsonb_build_object(
        'records_deleted', cnt,
        'date_range_start', oldest_record_date,
        'date_range_end', newest_deleted_date,
        'retention_policy_days', pol.retention_days,
        'executed_at', now()
      )
    );

    IF pol.archive_table_name IS NOT NULL AND pol.archive_table_name <> '' THEN
      -- Create archive table if not exists (same structure, no data)
      archive_sql := format(
        'CREATE TABLE IF NOT EXISTS public.%I (LIKE public.%I INCLUDING DEFAULTS)',
        pol.archive_table_name,
        pol.table_name
      );
      EXECUTE archive_sql;
      -- Copy rows into archive before delete
      sql := format(
        'INSERT INTO public.%I SELECT * FROM public.%I WHERE %I < $1',
        pol.archive_table_name,
        pol.table_name,
        pol.date_column
      );
      EXECUTE sql USING cutoff;
      -- Delete from source
      sql := format(
        'DELETE FROM public.%I WHERE %I < $1',
        pol.table_name,
        pol.date_column
      );
      EXECUTE sql USING cutoff;
    ELSE
      sql := format(
        'DELETE FROM public.%I WHERE %I < $1',
        pol.table_name,
        pol.date_column
      );
      EXECUTE sql USING cutoff;
    END IF;

    GET DIAGNOSTICS cnt = ROW_COUNT;
    table_name := pol.table_name;
    deleted_count := cnt;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.run_data_retention() IS
  'Deletes compliance records older than retention_days. Logs each batch to safety_audit_log before delete. If archive_table_name is set, copies rows to archive table first.';
