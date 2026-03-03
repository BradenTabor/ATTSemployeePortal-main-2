-- Repair: ensure certification_expiry_digest exists on email_list_key.
-- Safe to run if the value already exists (idempotent).
-- Use this if you see: invalid input value for enum email_list_key: "certification_expiry_digest"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'email_list_key'
    AND e.enumlabel = 'certification_expiry_digest'
  ) THEN
    ALTER TYPE public.email_list_key ADD VALUE 'certification_expiry_digest';
  END IF;
END;
$$;
