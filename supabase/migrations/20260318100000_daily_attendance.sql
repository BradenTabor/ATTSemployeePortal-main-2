-- =============================================================================
-- Daily attendance tracking for General Foreman roll-call
-- Statuses: present, absent, ncns (no call no show), rto (requested time off)
-- =============================================================================

CREATE TABLE public.daily_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'ncns', 'rto')),
  marked_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_daily_attendance_user_date ON public.daily_attendance(user_id, date);
CREATE INDEX idx_daily_attendance_date ON public.daily_attendance(date);
CREATE INDEX idx_daily_attendance_date_status ON public.daily_attendance(date, status);

COMMENT ON TABLE public.daily_attendance IS 'Per-user daily attendance tracked by General Foreman. Syncs non-present statuses to user_absences for SMS suppression.';

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_daily_attendance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_attendance_updated_at
  BEFORE UPDATE ON public.daily_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_daily_attendance_updated_at();

-- =============================================================================
-- RLS Policies
-- Policies are permissive (default) and OR-combined for same-operation checks.
-- If a RESTRICTIVE policy is added later, review the interaction.
-- =============================================================================
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

-- Leadership roles can do everything (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "daily_attendance_leadership_all" ON public.daily_attendance;
CREATE POLICY "daily_attendance_leadership_all"
  ON public.daily_attendance FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'general_foreman', 'manager', 'foreman')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'general_foreman', 'manager', 'foreman')
    )
  );

-- Employees can SELECT their own records only
DROP POLICY IF EXISTS "daily_attendance_employee_select_own" ON public.daily_attendance;
CREATE POLICY "daily_attendance_employee_select_own"
  ON public.daily_attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role full access (for Edge Functions / cron jobs)
DROP POLICY IF EXISTS "daily_attendance_service_role" ON public.daily_attendance;
CREATE POLICY "daily_attendance_service_role"
  ON public.daily_attendance FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- Sync trigger: mirror non-present statuses into user_absences so Edge Functions
-- (safety-briefing-reminder-sms, safety-briefing-escalation-sms,
-- monthly-compliance-summary) suppress notifications for absent workers.
--
-- Mapping is for suppression logic only, NOT for display:
--   absent -> 'sick'   (user_absences type)
--   ncns   -> 'leave'  (user_absences type)
--   rto    -> 'pto'    (user_absences type)
--   present -> deletes any existing user_absences row for that date
--
-- No UI surfaces user_absences.type directly, so this mapping is safe.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_attendance_to_absences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  absence_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_absences
    WHERE user_id = OLD.user_id AND date = OLD.date;
    RETURN OLD;
  END IF;

  CASE NEW.status
    WHEN 'absent' THEN absence_type := 'sick';
    WHEN 'ncns'   THEN absence_type := 'leave';
    WHEN 'rto'    THEN absence_type := 'pto';
    WHEN 'present' THEN
      DELETE FROM public.user_absences
      WHERE user_id = NEW.user_id AND date = NEW.date;
      RETURN NEW;
  END CASE;

  INSERT INTO public.user_absences (user_id, date, type, created_by)
  VALUES (NEW.user_id, NEW.date, absence_type, NEW.marked_by)
  ON CONFLICT (user_id, date)
  DO UPDATE SET type = EXCLUDED.type;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_attendance_to_absences
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_attendance_to_absences();
