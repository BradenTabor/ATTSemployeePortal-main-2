/*
  Email Recipient Lists – DB-driven admin email recipients

  - email_list_key ENUM: compliance_summary, safety_forecast
  - email_recipient_lists: list_key, email (validated, lowercase), created_by
  - email_send_log: audit of send attempts
  - Trigger: prevent deleting last recipient per list
  - RLS: SELECT authenticated, INSERT/DELETE admins only
  - Seed from current compliance/safety-forecast defaults
*/

-- ENUM for list keys (avoids typos, orphan lists)
DO $$ BEGIN
  CREATE TYPE public.email_list_key AS ENUM (
    'compliance_summary',
    'safety_forecast'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Recipient lists
CREATE TABLE IF NOT EXISTS public.email_recipient_lists (
  list_key public.email_list_key NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT email_lowercase CHECK (email = LOWER(email)),
  PRIMARY KEY (list_key, email)
);

CREATE INDEX IF NOT EXISTS idx_email_recipients_list_key ON public.email_recipient_lists(list_key);

COMMENT ON TABLE public.email_recipient_lists IS 'Admin-managed recipients per automated email list. Used by compliance and safety-forecast crons.';

-- Prevent deleting last recipient per list
CREATE OR REPLACE FUNCTION public.check_min_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF (SELECT COUNT(*) FROM public.email_recipient_lists WHERE list_key = OLD.list_key) <= 1 THEN
      RAISE EXCEPTION 'Cannot delete last recipient from list: %', OLD.list_key;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_empty_recipient_list ON public.email_recipient_lists;
CREATE TRIGGER prevent_empty_recipient_list
  BEFORE DELETE ON public.email_recipient_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.check_min_recipients();

-- Email send audit log
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_key public.email_list_key NOT NULL,
  recipients TEXT[] NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at ON public.email_send_log(sent_at DESC);

COMMENT ON TABLE public.email_send_log IS 'Audit log of email send attempts (crons).';

-- RLS for email_recipient_lists
ALTER TABLE public.email_recipient_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_recipients_select" ON public.email_recipient_lists;
CREATE POLICY "email_recipients_select"
  ON public.email_recipient_lists FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "email_recipients_insert" ON public.email_recipient_lists;
CREATE POLICY "email_recipients_insert"
  ON public.email_recipient_lists FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "email_recipients_delete" ON public.email_recipient_lists;
CREATE POLICY "email_recipients_delete"
  ON public.email_recipient_lists FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- RLS for email_send_log (admins only; crons use service role)
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_send_log_admin_select" ON public.email_send_log;
CREATE POLICY "email_send_log_admin_select"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Seed from current defaults (idempotent)
INSERT INTO public.email_recipient_lists (list_key, email)
VALUES
  ('compliance_summary', 'bradenleetabor@gmail.com'),
  ('compliance_summary', 'shane@alltts.com'),
  ('compliance_summary', 'dusty@alltts.com'),
  ('compliance_summary', 'mike@alltts.com'),
  ('compliance_summary', 'steve@alltts.com'),
  ('compliance_summary', 'brandon@alltts.com'),
  ('safety_forecast', 'bradenleetabor@gmail.com'),
  ('safety_forecast', 'shane@alltts.com'),
  ('safety_forecast', 'dusty@alltts.com'),
  ('safety_forecast', 'mike@alltts.com'),
  ('safety_forecast', 'steve@alltts.com'),
  ('safety_forecast', 'brandon@alltts.com')
ON CONFLICT (list_key, email) DO NOTHING;
