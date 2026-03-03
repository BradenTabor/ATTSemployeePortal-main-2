-- =============================================================================
-- RPC: get_briefing_compliance_summary – for Briefing Compliance dashboard
-- Returns one row per (field user, date) in range where an announcement exists.
-- Joins: app_users, announcements, safety_briefing_answers, announcement_rewards,
-- company_calendar, user_absences, crew_members/crews, supervisor (app_users).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_briefing_compliance_summary(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  role text,
  crew_name text,
  supervisor_name text,
  briefing_date date,
  completed boolean,
  reward_claimed boolean,
  suppressed boolean,
  suppression_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dates AS (
    SELECT d::date AS briefing_date
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d
  ),
  ann_by_date AS (
    SELECT DISTINCT ON (a.date) a.id AS announcement_id, a.date AS briefing_date
    FROM public.announcements a
    WHERE a.date >= p_start_date AND a.date <= p_end_date
    ORDER BY a.date, a.id
  ),
  field_users AS (
    SELECT au.user_id, au.full_name, au.role, au.manager_id
    FROM public.app_users au
    WHERE au.role IN ('employee', 'foreman', 'general_foreman', 'mechanic')
      AND au.status = 'active'
  ),
  grid AS (
    SELECT fu.user_id, fu.full_name, fu.role, fu.manager_id, ab.briefing_date, ab.announcement_id
    FROM field_users fu
    CROSS JOIN ann_by_date ab
  ),
  crew_one AS (
    SELECT DISTINCT ON (cm.user_id) cm.user_id, c.name AS crew_name
    FROM public.crew_members cm
    JOIN public.crews c ON c.id = cm.crew_id AND c.is_active = true
    ORDER BY cm.user_id, c.name
  ),
  sup_names AS (
    SELECT sup.id, sup.full_name AS supervisor_name
    FROM public.app_users sup
  )
  SELECT
    g.user_id,
    g.full_name::text,
    g.role::text,
    co.crew_name::text,
    sn.supervisor_name::text,
    g.briefing_date,
    EXISTS (
      SELECT 1 FROM public.safety_briefing_answers sba
      WHERE sba.user_id = g.user_id AND sba.briefing_date = g.briefing_date
    ) AS completed,
    EXISTS (
      SELECT 1 FROM public.announcement_rewards ar
      WHERE ar.user_id = g.user_id AND ar.announcement_id = g.announcement_id
    ) AS reward_claimed,
    (
      EXISTS (SELECT 1 FROM public.company_calendar cc WHERE cc.date = g.briefing_date)
      OR EXISTS (SELECT 1 FROM public.user_absences ua WHERE ua.user_id = g.user_id AND ua.date = g.briefing_date)
    ) AS suppressed,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.company_calendar cc WHERE cc.date = g.briefing_date) THEN 'company_off'::text
      WHEN EXISTS (SELECT 1 FROM public.user_absences ua WHERE ua.user_id = g.user_id AND ua.date = g.briefing_date) THEN 'user_absence'::text
      ELSE NULL::text
    END AS suppression_reason
  FROM grid g
  LEFT JOIN crew_one co ON co.user_id = g.user_id
  LEFT JOIN sup_names sn ON sn.id = g.manager_id
  ORDER BY g.briefing_date DESC, g.full_name;
$$;

COMMENT ON FUNCTION public.get_briefing_compliance_summary(date, date) IS
  'Briefing compliance rows for dashboard: one per (field user, date) when an announcement exists. Includes completed, reward_claimed, suppressed, crew, supervisor.';

GRANT EXECUTE ON FUNCTION public.get_briefing_compliance_summary(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_briefing_compliance_summary(date, date) TO service_role;
