-- RPC: get_user_last_activity
-- Returns (user_id, last_activity_at) for each user based on form submissions and safety events.
-- Used by Admin User Activity to show correct "last active" for offline users (instead of account created_at).
-- Caller must be admin (RLS enforced via SECURITY INVOKER + app_users.role check in policy on underlying tables).

CREATE OR REPLACE FUNCTION public.get_user_last_activity()
RETURNS TABLE(user_id uuid, last_activity_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT u.user_id, MAX(u.ts) AS last_activity_at
  FROM (
    SELECT dr.user_id, dr.created_at AS ts FROM public.dvir_reports dr WHERE dr.user_id IS NOT NULL
    UNION ALL
    SELECT dj.user_id, dj.created_at FROM public.daily_jsa dj WHERE dj.user_id IS NOT NULL
    UNION ALL
    SELECT de.user_id, de.created_at FROM public.daily_equipment_inspections de WHERE de.user_id IS NOT NULL
    UNION ALL
    SELECT si.reported_by AS user_id, si.reported_at AS ts
    FROM public.safety_incidents si WHERE si.reported_by IS NOT NULL AND si.reported_at IS NOT NULL
    UNION ALL
    SELECT te.user_id, te.created_at FROM public.telemetry_events te WHERE te.user_id IS NOT NULL
  ) u
  GROUP BY u.user_id;
$$;

COMMENT ON FUNCTION public.get_user_last_activity() IS
  'Returns most recent activity timestamp per user from DVIR, JSA, equipment, safety incidents, telemetry. Admin User Activity uses this for offline users last_seen. SECURITY INVOKER.';
