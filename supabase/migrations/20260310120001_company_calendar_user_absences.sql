-- =============================================================================
-- Company calendar + user absences for SMS escalation suppression
-- Phase 1: Skip tier-0 reminder and escalation when company is off or user is absent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.company_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('holiday', 'weather_day', 'company_day_off')),
  label text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_calendar_date ON public.company_calendar(date);

COMMENT ON TABLE public.company_calendar IS 'Company-wide days off; suppresses safety briefing reminders and escalation for that date.';

CREATE TABLE IF NOT EXISTS public.user_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('pto', 'sick', 'leave')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_absences_user_date ON public.user_absences(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_absences_date ON public.user_absences(date);

COMMENT ON TABLE public.user_absences IS 'Per-user absence by date; excludes user from safety briefing reminder and escalation for that date.';

-- RLS: admin/manager/safety_officer/general_foreman/foreman can manage; admin can SELECT all
ALTER TABLE public.company_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_calendar_admin_select" ON public.company_calendar;
CREATE POLICY "company_calendar_admin_select"
  ON public.company_calendar FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "company_calendar_manage_roles" ON public.company_calendar;
CREATE POLICY "company_calendar_manage_roles"
  ON public.company_calendar FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('manager', 'safety_officer', 'general_foreman', 'foreman'))
  )
  WITH CHECK (
    public.is_admin() OR
    EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('manager', 'safety_officer', 'general_foreman', 'foreman'))
  );

DROP POLICY IF EXISTS "user_absences_admin_select" ON public.user_absences;
CREATE POLICY "user_absences_admin_select"
  ON public.user_absences FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "user_absences_manage_roles" ON public.user_absences;
CREATE POLICY "user_absences_manage_roles"
  ON public.user_absences FOR ALL TO authenticated
  USING (
    public.is_admin() OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('manager', 'safety_officer', 'general_foreman', 'foreman'))
  )
  WITH CHECK (
    public.is_admin() OR
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('manager', 'safety_officer', 'general_foreman', 'foreman'))
  );

-- Service role full access (for Edge Functions)
DROP POLICY IF EXISTS "company_calendar_service_role" ON public.company_calendar;
CREATE POLICY "company_calendar_service_role"
  ON public.company_calendar FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_absences_service_role" ON public.user_absences;
CREATE POLICY "user_absences_service_role"
  ON public.user_absences FOR ALL TO service_role USING (true) WITH CHECK (true);
