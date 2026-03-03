-- Add email list key for safety rewards drawing winners notification.
-- Note: New enum value cannot be used in the same transaction; seed is in next migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'safety_rewards_winners'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_list_key')
  ) THEN
    ALTER TYPE public.email_list_key ADD VALUE 'safety_rewards_winners';
  END IF;
END;
$$;
