/*
  ============================================================================
  JSA Paper Form Photo Upload System
  ============================================================================

  Adds support for uploading photos of paper JSA forms:
  1. Private storage bucket for JSA photos (NOT public — contains sensitive data)
  2. Storage policies: authenticated SELECT, owner-scoped INSERT/DELETE
  3. jsa_photo_paths text[] column on daily_jsa
  4. Updates file validation trigger to include jsa-photos bucket
  5. OSHA compliance mapping entry (documentation retention framing)
  6. Storage cleanup queue table + trigger for cascade deletion

  ============================================================================
*/

-- ============================================================================
-- STEP 1: PRIVATE STORAGE BUCKET
-- ============================================================================
-- JSA paper forms may contain employee names, signatures, and hazard details.
-- Using a private bucket with signed URLs for controlled access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('jsa-photos', 'jsa-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: STORAGE POLICIES
-- ============================================================================
-- Authenticated users can view JSA photos (RLS on daily_jsa controls who
-- sees which paths; the bucket just needs auth gate).
-- INSERT/DELETE scoped to owner's folder prefix: {user_id}/...

DROP POLICY IF EXISTS "jsa_photos_authenticated_select" ON storage.objects;
CREATE POLICY "jsa_photos_authenticated_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'jsa-photos');

DROP POLICY IF EXISTS "jsa_photos_owner_insert" ON storage.objects;
CREATE POLICY "jsa_photos_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'jsa-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "jsa_photos_owner_delete" ON storage.objects;
CREATE POLICY "jsa_photos_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'jsa-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STEP 3: DB COLUMN
-- ============================================================================

ALTER TABLE public.daily_jsa
  ADD COLUMN IF NOT EXISTS jsa_photo_paths text[] DEFAULT '{}';

COMMENT ON COLUMN public.daily_jsa.jsa_photo_paths IS
  'Storage paths for uploaded paper JSA form images in the jsa-photos bucket. '
  'Path format: {userId}/{timestamp}-page{n}.jpg. Supports up to 5 images per JSA.';

-- ============================================================================
-- STEP 4: UPDATE FILE VALIDATION TRIGGER (SKIPPED IN MIGRATION)
-- ============================================================================
-- PLATFORM LIMITATION: The storage schema is not writable by the project role.
-- Server-side validation for jsa-photos is not applied here. Rely on
-- client-side validation (validators.photoFile) + RLS (already in place).
-- To add 'jsa-photos' to storage.validate_file_upload(), request Supabase support.

-- ============================================================================
-- STEP 5: OSHA COMPLIANCE MAPPING (documentation retention framing)
-- ============================================================================

INSERT INTO public.osha_compliance_mapping
  (osha_regulation, requirement_description, data_source, validation_rule)
VALUES
  ('29 CFR 1926.20', 'Paper JSA form digital retention',
   'daily_jsa (jsa_photo_paths); jsa-photos storage bucket',
   'Supports documentation retention for paper JSA forms')
ON CONFLICT (osha_regulation, requirement_description) DO UPDATE SET
  data_source = EXCLUDED.data_source,
  validation_rule = EXCLUDED.validation_rule;

-- ============================================================================
-- STEP 6: STORAGE CLEANUP QUEUE TABLE
-- ============================================================================
-- Generic table for async storage file deletion.
-- Processed by edge function or cron that calls storage.remove().
-- Reusable by future features (DVIR, equipment, etc).

CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  paths text[] NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_storage_cleanup_unprocessed
  ON public.storage_cleanup_queue (created_at)
  WHERE processed_at IS NULL;

COMMENT ON TABLE public.storage_cleanup_queue IS
  'Queue for async storage file deletion when parent records are deleted. '
  'Processed by edge function/cron. Rows with processed_at IS NULL are pending.';

ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

-- Only admins/service role need to read/write the cleanup queue
DROP POLICY IF EXISTS "storage_cleanup_queue_service_access" ON public.storage_cleanup_queue;
CREATE POLICY "storage_cleanup_queue_service_access"
  ON public.storage_cleanup_queue
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid()
      AND app_users.role IN ('admin')
    )
  );

-- ============================================================================
-- STEP 7: CLEANUP TRIGGER ON daily_jsa DELETE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_jsa_photos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.jsa_photo_paths IS NOT NULL AND array_length(OLD.jsa_photo_paths, 1) > 0 THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, paths, source_table, source_id)
    VALUES ('jsa-photos', OLD.jsa_photo_paths, 'daily_jsa', OLD.id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_jsa_photos ON public.daily_jsa;
CREATE TRIGGER trg_cleanup_jsa_photos
  AFTER DELETE ON public.daily_jsa
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_jsa_photos();

COMMENT ON FUNCTION public.cleanup_jsa_photos() IS
  'Queues JSA photo storage paths for async deletion when a daily_jsa record is deleted.';
