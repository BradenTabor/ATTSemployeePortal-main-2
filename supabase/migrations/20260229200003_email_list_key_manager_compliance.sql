-- Phase 2: Allow logging manager compliance emails in email_send_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'manager_compliance'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_list_key')
  ) THEN
    ALTER TYPE public.email_list_key ADD VALUE 'manager_compliance';
  END IF;
END;
$$;
