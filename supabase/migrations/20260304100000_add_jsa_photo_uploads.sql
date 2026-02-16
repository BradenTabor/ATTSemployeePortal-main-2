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
-- STEP 4: UPDATE FILE VALIDATION TRIGGER
-- ============================================================================
-- PLATFORM LIMITATION: The storage schema is not writable by the project role.
-- Neither the migration API nor the Dashboard SQL Editor can run this.
-- To add server-side file validation for jsa-photos, either:
--   (1) Request Supabase support to add 'jsa-photos' to storage.validate_file_upload(), or
--   (2) Rely on client-side validation (validators.photoFile) + RLS (already in place).
-- The full function body below is for reference only; do not run it in the project.

CREATE OR REPLACE FUNCTION storage.validate_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket_id text;
  v_file_name text;
  v_file_size bigint;
  v_mime_type text;
  v_file_extension text;
  v_max_size_bytes bigint := 10 * 1024 * 1024; -- 10MB default
  v_allowed_types text[] := ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ];
BEGIN
  v_bucket_id := NEW.bucket_id;
  v_file_name := NEW.name;

  -- Extract metadata (may be null at INSERT time, but we check if present)
  v_file_size := (NEW.metadata->>'size')::bigint;
  v_mime_type := NEW.metadata->>'mimetype';

  -- Extract file extension from filename
  v_file_extension := lower(reverse(split_part(reverse(v_file_name), '.', 1)));

  -- Skip validation for service role (bypasses RLS)
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Validate file size (if metadata includes size at INSERT time)
  IF v_file_size IS NOT NULL AND v_file_size > v_max_size_bytes THEN
    RAISE EXCEPTION 'File size exceeds maximum allowed size of 10MB. File size: % bytes', v_file_size;
  END IF;

  -- Validate file type for image buckets (added 'jsa-photos')
  IF v_bucket_id IN ('dvir-photos', 'equipment-inspection-photos', 'avatars', 'jsa-photos') THEN
    -- Check MIME type
    IF v_mime_type IS NOT NULL AND NOT (v_mime_type = ANY(v_allowed_types)) THEN
      RAISE EXCEPTION 'Invalid file type: %. Allowed types: JPEG, PNG, WebP, GIF', v_mime_type;
    END IF;

    -- Check file extension as backup validation
    IF v_file_extension NOT IN ('jpg', 'jpeg', 'png', 'webp', 'gif') THEN
      RAISE EXCEPTION 'Invalid file extension: .%. Allowed extensions: .jpg, .jpeg, .png, .webp, .gif', v_file_extension;
    END IF;
  END IF;

  -- Additional validation: prevent executable files
  IF v_file_extension IN ('exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar', 'app', 'deb', 'rpm', 'dmg', 'pkg') THEN
    RAISE EXCEPTION 'Executable files are not allowed. File extension: .%', v_file_extension;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'File upload validation failed: %', SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION storage.validate_file_upload() IS
  'Validates file uploads to storage buckets. Checks file type, size, and prevents executable files. SEC-003 security fix. Updated to include jsa-photos bucket.';

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
