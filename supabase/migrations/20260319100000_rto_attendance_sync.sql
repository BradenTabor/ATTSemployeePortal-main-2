-- =============================================================================
-- RTO-to-attendance sync: approved RTOs auto-populate daily_attendance (rto)
-- plus attendance_summaries cache table for AI summary (24h TTL in Edge Function)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1a. approved_by on rto_requests (set when admin approves; NULL for pre-migration rows)
-- -----------------------------------------------------------------------------
ALTER TABLE public.rto_requests
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.rto_requests.approved_by IS
  'User who approved the request. NULL for rows approved before this column existed. Trigger uses COALESCE(approved_by, auth.uid(), sentinel).';

-- -----------------------------------------------------------------------------
-- 1b. Trigger: on RTO status -> Approved, insert daily_attendance (rto) for weekdays
--     Cap 90 days; on un-approval delete only auto-synced rows.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_rto_approval_to_attendance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  curr date;
  approver uuid;
  day_span int;
  SYSTEM_USER_ID constant uuid := '00000000-0000-0000-0000-000000000000';
  MAX_RTO_DAYS constant int := 90;
BEGIN
  approver := COALESCE(NEW.approved_by, auth.uid(), SYSTEM_USER_ID);

  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    day_span := (NEW.end_date - NEW.start_date) + 1;

    IF day_span > MAX_RTO_DAYS THEN
      RAISE WARNING '[sync_rto_approval] RTO #% spans % days (max %), skipping auto-sync',
        NEW.id, day_span, MAX_RTO_DAYS;
      RETURN NEW;
    END IF;

    curr := NEW.start_date;
    WHILE curr <= NEW.end_date LOOP
      IF EXTRACT(DOW FROM curr) BETWEEN 1 AND 5 THEN
        INSERT INTO public.daily_attendance (user_id, date, status, marked_by, notes)
        VALUES (NEW.user_id, curr, 'rto', approver,
                'Auto-synced from RTO #' || NEW.id)
        ON CONFLICT (user_id, date)
        DO UPDATE SET status = 'rto',
                      marked_by = EXCLUDED.marked_by,
                      notes = EXCLUDED.notes;
      END IF;
      curr := curr + 1;
    END LOOP;
  END IF;

  IF OLD.status = 'Approved' AND NEW.status IS DISTINCT FROM 'Approved' THEN
    DELETE FROM public.daily_attendance
    WHERE user_id = OLD.user_id
      AND date BETWEEN OLD.start_date AND OLD.end_date
      AND status = 'rto'
      AND notes LIKE 'Auto-synced from RTO #%';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rto_approved_sync
  AFTER UPDATE ON public.rto_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_rto_approval_to_attendance();

-- -----------------------------------------------------------------------------
-- 1c. attendance_summaries cache (AI summary; 24h TTL enforced in Edge Function)
-- -----------------------------------------------------------------------------
CREATE TABLE public.attendance_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  summary text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (start_date, end_date)
);

CREATE INDEX idx_attendance_summaries_dates
  ON public.attendance_summaries(start_date, end_date);

COMMENT ON TABLE public.attendance_summaries IS
  'Cache for AI-generated attendance summaries. Keyed by date range, 24h TTL enforced by Edge Function.';

CREATE TRIGGER trg_attendance_summaries_updated_at
  BEFORE UPDATE ON public.attendance_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_daily_attendance_updated_at();

COMMENT ON TRIGGER trg_attendance_summaries_updated_at ON public.attendance_summaries IS
  'Reuses set_daily_attendance_updated_at() for NEW.updated_at = now(); function name is legacy, logic is generic.';

ALTER TABLE public.attendance_summaries ENABLE ROW LEVEL SECURITY;

-- Leadership (admin, general_foreman, manager) only. Foreman excluded by design:
-- foremen do not see AI summaries about all employees; only roll-call and daily_attendance.
CREATE POLICY "attendance_summaries_leadership_all"
  ON public.attendance_summaries FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'general_foreman', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'general_foreman', 'manager')
    )
  );

CREATE POLICY "attendance_summaries_service_role"
  ON public.attendance_summaries FOR ALL TO service_role
  USING (true) WITH CHECK (true);
