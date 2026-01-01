/*
  ============================================================================
  FIX ANNOUNCEMENTS TABLE - ADD MISSING updated_at COLUMN
  ============================================================================
  
  The announcements table was created without an updated_at column, but a 
  trigger (trigger_update_announcements_updated_at) was added that expects it.
  
  This migration adds the missing column to prevent the error:
  "record 'new' has no field 'updated_at'"
  
  All operations are idempotent (safe to run multiple times).
  ============================================================================
*/

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'announcements' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.announcements 
    ADD COLUMN updated_at timestamptz DEFAULT now();
    
    RAISE NOTICE 'Added updated_at column to announcements table';
  ELSE
    RAISE NOTICE 'updated_at column already exists in announcements table';
  END IF;
END
$$;

-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it's properly attached
DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON public.announcements;
CREATE TRIGGER trigger_update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.announcements.updated_at IS 
  'Timestamp of last update, automatically maintained by trigger';

