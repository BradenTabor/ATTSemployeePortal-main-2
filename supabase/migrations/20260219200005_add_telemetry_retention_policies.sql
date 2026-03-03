-- ============================================================================
-- Phase 7: Add retention policies for telemetry/session bloat
-- run_data_retention() (existing cron) will delete rows older than retention_days.
-- ============================================================================

INSERT INTO public.data_retention_policies (table_name, date_column, retention_days, enabled)
VALUES
  ('user_activity_sessions', 'last_seen_at', 30, true),
  ('telemetry_events', 'created_at', 90, true),
  ('notification_outbox', 'created_at', 30, true)
ON CONFLICT (table_name) DO UPDATE SET
  date_column = EXCLUDED.date_column,
  retention_days = EXCLUDED.retention_days,
  enabled = EXCLUDED.enabled,
  updated_at = now();
