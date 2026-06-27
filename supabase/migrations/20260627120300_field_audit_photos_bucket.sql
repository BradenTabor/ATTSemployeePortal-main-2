-- =============================================================================
-- Field Safety Audit — Migration 4/4: private photo bucket + owner-scoped RLS
-- =============================================================================
-- Mirrors the jsa-photos pattern (20260304100000): a PRIVATE bucket with
-- authenticated SELECT and owner-folder-scoped INSERT/DELETE. Photos may show
-- crew members and hazard details, so the bucket is private (served via signed
-- URLs); per-path access is governed by app-table RLS.
--
-- PLATFORM LIMITATION: storage.validate_file_upload() is not writable by the
-- project role on this project (documented in the jsa-photos migration), so the
-- server-side allow-list is NOT edited here. Upload validation relies on
-- client-side checks (validators.photoFile) + the RLS policies below.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('field-audit-photos', 'field-audit-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users may read; the bucket just needs an auth gate (app-table
-- RLS controls which photo_path values a user can discover).
DROP POLICY IF EXISTS "field_audit_photos_authenticated_select" ON storage.objects;
CREATE POLICY "field_audit_photos_authenticated_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'field-audit-photos');

-- INSERT/DELETE scoped to the owner's folder prefix: {user_id}/...
DROP POLICY IF EXISTS "field_audit_photos_owner_insert" ON storage.objects;
CREATE POLICY "field_audit_photos_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'field-audit-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "field_audit_photos_owner_delete" ON storage.objects;
CREATE POLICY "field_audit_photos_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'field-audit-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
