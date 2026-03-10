-- Add email list key for weekly attendance summary recipients.
-- Note: New enum value cannot be used in the same transaction; seed is in next migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'weekly_attendance_summary'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_list_key')
  ) THEN
    ALTER TYPE public.email_list_key ADD VALUE 'weekly_attendance_summary';
  END IF;
END;
$$;
