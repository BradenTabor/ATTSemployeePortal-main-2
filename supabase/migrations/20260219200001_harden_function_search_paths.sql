-- ============================================================================
-- Phase 2: Harden function search_path (25 functions)
-- Excludes get_active_risk_config and auto_tune_algorithm (dropped in Phase 4).
-- ============================================================================

ALTER FUNCTION public.update_user_activity_updated_at() SET search_path = public;
ALTER FUNCTION public.is_reward_claim_window() SET search_path = public;
ALTER FUNCTION public.cleanup_stale_sessions() SET search_path = public;
ALTER FUNCTION public.mark_idle_sessions() SET search_path = public;
ALTER FUNCTION public.refresh_asset_cost_summary() SET search_path = public;
ALTER FUNCTION public.queue_asset_cost_refresh() SET search_path = public;
ALTER FUNCTION public.ensure_single_default_contact_template() SET search_path = public;
ALTER FUNCTION public.check_reward_claim_window() SET search_path = public;
ALTER FUNCTION public.check_latest_announcement_claim() SET search_path = public;
ALTER FUNCTION public.get_next_algorithm_version() SET search_path = public;
ALTER FUNCTION public.can_log_incidents() SET search_path = public;
ALTER FUNCTION public.calculate_prediction_accuracy(date, date) SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.calculate_factor_performance(date, date) SET search_path = public;
ALTER FUNCTION public.update_crews_updated_at() SET search_path = public;
ALTER FUNCTION public.normalize_truck_number() SET search_path = public;
ALTER FUNCTION public.update_maintenance_schedule_on_log() SET search_path = public;
ALTER FUNCTION public.update_schedule_mileage_from_dvir() SET search_path = public;
ALTER FUNCTION public.check_min_recipients() SET search_path = public;
ALTER FUNCTION public.update_work_sites_updated_at() SET search_path = public;
ALTER FUNCTION public.update_notification_preferences_updated_at() SET search_path = public;
ALTER FUNCTION public.update_safety_announcements_updated_at() SET search_path = public;
ALTER FUNCTION public.update_job_progress_trackers_updated_at() SET search_path = public;
ALTER FUNCTION public.get_user_compliance_points(uuid, date, date) SET search_path = public;
ALTER FUNCTION public.get_compliance_leaderboard(date, date, integer) SET search_path = public;
