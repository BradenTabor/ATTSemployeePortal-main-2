-- =============================================================================
-- Migration: Create cert-documents Storage bucket and policies
-- Purpose: Stores uploaded proof documents for external certifications
-- Upload path convention: cert-documents/{worker_user_id}/{external_cert_id}/{filename}
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('cert-documents', 'cert-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Admins and safety officers can upload
CREATE POLICY cert_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cert-documents'
    AND EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('admin', 'safety_officer'))
  );

-- Workers can download their own documents (scoped by folder = their user_id)
-- Admins and safety officers can download all documents
CREATE POLICY cert_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cert-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('admin', 'safety_officer'))
    )
  );

-- Only admins can delete
CREATE POLICY cert_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cert-documents'
    AND EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admins can update (replace) documents
CREATE POLICY cert_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cert-documents'
    AND EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('admin', 'safety_officer'))
  );
