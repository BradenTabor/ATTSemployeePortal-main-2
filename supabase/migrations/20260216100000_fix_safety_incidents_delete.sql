-- Fix safety_incidents admin DELETE vulnerability (OSHA 29 CFR 1904.33: 5-year retention).
-- Replace FOR ALL policy with separate SELECT/INSERT/UPDATE only; no DELETE for any role.

DROP POLICY IF EXISTS "safety_incidents_admin_all" ON public.safety_incidents;

CREATE POLICY safety_incidents_admin_select ON public.safety_incidents
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY safety_incidents_admin_insert ON public.safety_incidents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY safety_incidents_admin_update ON public.safety_incidents
  FOR UPDATE TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.safety_incidents IS
  'OSHA 5-year retention required (29 CFR 1904.33). DELETE intentionally blocked at RLS level.';
