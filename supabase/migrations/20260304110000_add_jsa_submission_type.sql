-- Add submission_type to daily_jsa to distinguish digital vs paper JSA submissions.
-- CHECK constraint (not enum) allows adding a third type later without a migration.
-- Idempotent: safe to run if column already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_jsa' AND column_name = 'submission_type'
  ) THEN
    ALTER TABLE daily_jsa
      ADD COLUMN submission_type text NOT NULL DEFAULT 'digital'
      CHECK (submission_type IN ('digital', 'paper'));
    COMMENT ON COLUMN daily_jsa.submission_type IS 'How the JSA was submitted: digital (full form) or paper (photo upload only).';
  END IF;
END $$;
