/*
  Signatures storage bucket (Image Signature Capture - Safety Compliance P0)
  - Creates bucket for canvas signature images (PNG).
  - Path format: {user_id}/{form_type}/{timestamp}.png
  - Storage validation already allows image/png; add 'signatures' to image buckets.
*/

-- Storage bucket (public reads so signature URLs work in img src)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies
DROP POLICY IF EXISTS "signatures_public_select" ON storage.objects;
DROP POLICY IF EXISTS "signatures_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "signatures_authenticated_delete" ON storage.objects;

CREATE POLICY "signatures_public_select"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'signatures');

CREATE POLICY "signatures_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "signatures_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Note: If your project uses custom storage validation (e.g. validate_file_upload trigger),
-- add 'signatures' to the allowed image buckets in that function (requires schema owner).
-- Supabase default storage allows image/png; custom triggers may need a dashboard or
-- privileged migration update to include bucket_id = 'signatures'.
