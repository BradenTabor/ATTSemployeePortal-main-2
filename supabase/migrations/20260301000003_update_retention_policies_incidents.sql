/*
  Incident Retention (P0 — OSHA 1904.33)
  Add safety_incidents to data_retention_policies with 5-year (1825 days) retention.
  run_data_retention() already supports any table with a date_column; no code change.
*/

INSERT INTO public.data_retention_policies (table_name, date_column, retention_days, enabled)
VALUES ('safety_incidents', 'incident_date', 1825, true)
ON CONFLICT (table_name) DO UPDATE SET
  date_column = EXCLUDED.date_column,
  retention_days = EXCLUDED.retention_days,
  enabled = EXCLUDED.enabled,
  updated_at = now();

COMMENT ON TABLE public.data_retention_policies IS
  'Per-table retention rules. safety_incidents: 5 years per OSHA 1904.33.';
