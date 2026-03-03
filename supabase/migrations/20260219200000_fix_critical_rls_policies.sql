-- ============================================================================
-- Phase 1: Critical Security Fixes (Supabase Cleanup Plan)
-- ============================================================================
-- 1. Remove anon UPDATE on rto_requests (critical vulnerability)
-- 2. Scope jsa_sharing_audit INSERT to auth.uid() = changed_by
-- 3. Recreate 4 views as SECURITY INVOKER (user_activity_feed, pending_certification_reviews, unified_fix_costs, crew_with_member_count)
-- 4. Ensure user_profiles has anon revoked (stays SECURITY DEFINER due to auth.users join)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RTO: Drop anon UPDATE policy and use admin/manager-only update
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rto_update_public_approval" ON public.rto_requests;

-- Replace rto_update_admin with admin-or-manager policy (plan: is_admin_or_manager())
DROP POLICY IF EXISTS "rto_update_admin" ON public.rto_requests;
CREATE POLICY "rto_update_admin_or_manager"
  ON public.rto_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

COMMENT ON POLICY "rto_update_admin_or_manager" ON public.rto_requests IS
  'Admins and managers can update RTO request status (e.g. approval). Replaces previous anon policy.';

-- ----------------------------------------------------------------------------
-- 2. JSA sharing audit: restrict INSERT to caller = changed_by
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "jsa_sharing_audit_insert" ON public.jsa_sharing_audit;
CREATE POLICY "jsa_sharing_audit_insert"
  ON public.jsa_sharing_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

COMMENT ON POLICY "jsa_sharing_audit_insert" ON public.jsa_sharing_audit IS
  'Users can only insert audit rows where they are the one making the change.';

-- ----------------------------------------------------------------------------
-- 3. Recreate 4 views as SECURITY INVOKER (caller's RLS applies)
-- Underlying tables already grant SELECT to authenticated; no auth.users join.
-- ----------------------------------------------------------------------------

-- 3.1 user_activity_feed (user_activity_sessions + app_users)
DROP VIEW IF EXISTS public.user_activity_feed;
CREATE VIEW public.user_activity_feed
  WITH (security_invoker = true)
AS
SELECT
  uas.id,
  uas.user_id,
  uas.session_id,
  uas.status,
  uas.last_seen_at,
  uas.started_at,
  uas.ended_at,
  uas.current_page,
  uas.device_info,
  au.email,
  au.full_name,
  au.role,
  au.avatar_url,
  CASE
    WHEN uas.ended_at IS NOT NULL THEN uas.ended_at - uas.started_at
    ELSE now() - uas.started_at
  END AS session_duration,
  now() - uas.last_seen_at AS time_since_last_seen
FROM public.user_activity_sessions uas
LEFT JOIN public.app_users au ON au.user_id = uas.user_id
ORDER BY uas.last_seen_at DESC;

COMMENT ON VIEW public.user_activity_feed IS
  'Activity sessions with user profile. SECURITY INVOKER so caller RLS applies.';

-- 3.2 pending_certification_reviews
DROP VIEW IF EXISTS public.pending_certification_reviews;
CREATE VIEW public.pending_certification_reviews
  WITH (security_invoker = true)
AS
SELECT
  ca.id AS attempt_id,
  ca.user_id,
  au.full_name AS user_name,
  ct.id AS certification_type_id,
  ct.name AS certification_name,
  ct.slug AS certification_slug,
  ca.submitted_at,
  ca.total_questions,
  ca.correct_answers,
  ca.score_percentage,
  ca.answers,
  (
    SELECT COUNT(*)::int
    FROM jsonb_array_elements(ca.answers) a(value)
    WHERE (a.value ->> 'pending_review')::boolean = true
  ) AS pending_count
FROM public.certification_attempts ca
JOIN public.certification_types ct ON ct.id = ca.certification_type_id
LEFT JOIN public.app_users au ON au.user_id = ca.user_id
WHERE ca.status = 'submitted';

COMMENT ON VIEW public.pending_certification_reviews IS
  'Certification attempts pending admin review. SECURITY INVOKER.';

-- 3.3 unified_fix_costs (drop dependent materialized view first)
DROP MATERIALIZED VIEW IF EXISTS public.asset_cost_summary;
DROP VIEW IF EXISTS public.unified_fix_costs;
CREATE VIEW public.unified_fix_costs
  WITH (security_invoker = true)
AS
SELECT
  'repairs_log'::text AS source,
  vehicle_maintenance_log.id AS source_id,
  vehicle_maintenance_log.truck_number AS asset_number,
  'truck'::text AS asset_type,
  vehicle_maintenance_log.maintenance_type AS fix_type,
  vehicle_maintenance_log.description,
  vehicle_maintenance_log.cost AS recorded_cost,
  vehicle_maintenance_log.parts_used,
  vehicle_maintenance_log.service_date AS fix_date,
  vehicle_maintenance_log.performed_by_name AS performed_by,
  vehicle_maintenance_log.mileage_at_service AS mileage,
  vehicle_maintenance_log.created_at
FROM public.vehicle_maintenance_log
UNION ALL
SELECT
  'dvir'::text AS source,
  dvir_reports.id AS source_id,
  COALESCE(dvir_reports.truck_number, dvir_reports.mechanic_truck_number) AS asset_number,
  'truck'::text AS asset_type,
  'dvir_fix'::text AS fix_type,
  dvir_reports.deficiency_corrected AS description,
  dvir_reports.mechanic_cost AS recorded_cost,
  dvir_reports.mechanic_parts_used AS parts_used,
  COALESCE(dvir_reports.mechanic_date::date, dvir_reports.created_at::date) AS fix_date,
  NULL::text AS performed_by,
  dvir_reports.mileage,
  dvir_reports.created_at
FROM public.dvir_reports
WHERE dvir_reports.deficiency_corrected IS NOT NULL AND dvir_reports.deficiency_corrected <> ''
UNION ALL
SELECT
  'equipment'::text AS source,
  daily_equipment_inspections.id AS source_id,
  daily_equipment_inspections.equipment_number AS asset_number,
  CASE
    WHEN lower(daily_equipment_inspections.equipment_type) LIKE '%chipper%' THEN 'chipper'::text
    WHEN lower(daily_equipment_inspections.equipment_type) LIKE '%trailer%' THEN 'trailer'::text
    ELSE 'equipment'::text
  END AS asset_type,
  'equipment_fix'::text AS fix_type,
  daily_equipment_inspections.mechanic_fixes AS description,
  daily_equipment_inspections.mechanic_cost AS recorded_cost,
  daily_equipment_inspections.mechanic_parts_used AS parts_used,
  COALESCE(daily_equipment_inspections.last_mechanic_updated_at::date, daily_equipment_inspections.inspection_date) AS fix_date,
  NULL::text AS performed_by,
  NULL::numeric AS mileage,
  daily_equipment_inspections.created_at
FROM public.daily_equipment_inspections
WHERE daily_equipment_inspections.mechanic_fixes IS NOT NULL AND daily_equipment_inspections.mechanic_fixes <> '';

COMMENT ON VIEW public.unified_fix_costs IS
  'Unified view of fixes with costs. SECURITY INVOKER.';

-- Recreate materialized view that depended on unified_fix_costs
CREATE MATERIALIZED VIEW IF NOT EXISTS public.asset_cost_summary AS
SELECT
  asset_number,
  asset_type,
  COUNT(*) AS total_fixes,
  SUM(COALESCE(recorded_cost, 100)) AS total_estimated_cost,
  SUM(recorded_cost) AS total_recorded_cost,
  MAX(fix_date) AS last_fix_date,
  MIN(fix_date) AS first_fix_date,
  jsonb_agg(DISTINCT fix_type) AS fix_types
FROM public.unified_fix_costs
WHERE asset_number IS NOT NULL AND asset_number != ''
GROUP BY asset_number, asset_type
ORDER BY total_estimated_cost DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_cost_summary_pk
  ON public.asset_cost_summary(asset_type, asset_number);

-- 3.4 crew_with_member_count
DROP VIEW IF EXISTS public.crew_with_member_count;
CREATE VIEW public.crew_with_member_count
  WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  c.description,
  c.is_active,
  c.created_at,
  c.updated_at,
  c.created_by,
  count(cm.id) AS member_count
FROM public.crews c
LEFT JOIN public.crew_members cm ON c.id = cm.crew_id
GROUP BY c.id, c.name, c.description, c.is_active, c.created_at, c.updated_at, c.created_by;

COMMENT ON VIEW public.crew_with_member_count IS
  'Crews with member count. SECURITY INVOKER.';

-- ----------------------------------------------------------------------------
-- 4. user_profiles: ensure anon has no access (stays SECURITY DEFINER)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_profiles FROM public;
GRANT SELECT ON public.user_profiles TO authenticated;
