-- Add email list key for weekly safety audit report recipients.
-- Note: New enum value cannot be used in the same transaction; seed is in next migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'weekly_safety_audit'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_list_key')
  ) THEN
    ALTER TYPE public.email_list_key ADD VALUE 'weekly_safety_audit';
  END IF;
END;
$$;
