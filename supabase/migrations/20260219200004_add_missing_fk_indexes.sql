-- ============================================================================
-- Phase 6: Add indexes for unindexed foreign keys
-- Improves join and cascade performance (19 FKs identified by advisor).
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_safety_audit_log_user_id
  ON public.safety_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_events_actor_user_id
  ON public.notification_events(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_certification_records_certified_by
  ON public.certification_records(certified_by);
CREATE INDEX IF NOT EXISTS idx_certification_records_revoked_by
  ON public.certification_records(revoked_by);
CREATE INDEX IF NOT EXISTS idx_certification_records_written_attempt_id
  ON public.certification_records(written_attempt_id);
CREATE INDEX IF NOT EXISTS idx_certification_records_practical_evaluation_id
  ON public.certification_records(practical_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_certification_records_renewal_of
  ON public.certification_records(renewal_of);

CREATE INDEX IF NOT EXISTS idx_certification_access_grants_granted_by
  ON public.certification_access_grants(granted_by);

CREATE INDEX IF NOT EXISTS idx_certification_attempts_graded_by
  ON public.certification_attempts(graded_by);

CREATE INDEX IF NOT EXISTS idx_crew_members_added_by
  ON public.crew_members(added_by);

CREATE INDEX IF NOT EXISTS idx_crews_created_by
  ON public.crews(created_by);

CREATE INDEX IF NOT EXISTS idx_email_recipient_lists_created_by_user_id
  ON public.email_recipient_lists(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_risk_algorithm_config_created_by
  ON public.risk_algorithm_config(created_by);

CREATE INDEX IF NOT EXISTS idx_risk_score_history_forecast_run_id
  ON public.risk_score_history(forecast_run_id);

CREATE INDEX IF NOT EXISTS idx_safety_incidents_corrective_actions_by
  ON public.safety_incidents(corrective_actions_by);

CREATE INDEX IF NOT EXISTS idx_tuning_decisions_log_admin_user_id
  ON public.tuning_decisions_log(admin_user_id);

CREATE INDEX IF NOT EXISTS idx_safety_announcements_created_by
  ON public.safety_announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_safety_announcements_published_by
  ON public.safety_announcements(published_by);

CREATE INDEX IF NOT EXISTS idx_mileage_anomalies_resolved_by_user_id
  ON public.mileage_anomalies(resolved_by_user_id);
