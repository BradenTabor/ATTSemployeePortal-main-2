-- =============================================================================
-- Migration: Create worker_external_certifications table
-- Purpose: Links workers to external certification types with proof, dates,
--          and admin verification
-- =============================================================================

CREATE TABLE public.worker_external_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- RESTRICT, not CASCADE: deleting a type with existing worker records must fail
  -- explicitly. The intended workflow is archive (set is_active = false), not delete.
  -- CASCADE would silently destroy worker cert records with no audit trail.
  -- The UI should only expose "Archive" for types with existing records.
  external_certification_type_id UUID NOT NULL REFERENCES public.external_certification_types(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending_verification')),
  issued_date DATE,
  expiration_date DATE,
  issuing_authority TEXT,
  credential_number TEXT,
  -- Supabase Storage path; v1 supports one document.
  -- Future: could become document_urls TEXT[] or a join table
  -- if multi-document support is needed (front/back of card, renewal letters, etc.)
  document_url TEXT,
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by UUID REFERENCES auth.users(id),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique INDEX (not constraint) — prevents duplicate active/pending
-- records while allowing historical expired/revoked rows per worker per cert type
CREATE UNIQUE INDEX idx_wec_unique_active
  ON public.worker_external_certifications(user_id, external_certification_type_id)
  WHERE status IN ('active', 'pending_verification');

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_worker_ext_certs
  BEFORE UPDATE ON public.worker_external_certifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_wec_user_id ON public.worker_external_certifications(user_id);
CREATE INDEX idx_wec_type_id ON public.worker_external_certifications(external_certification_type_id);
CREATE INDEX idx_wec_expiration ON public.worker_external_certifications(expiration_date)
  WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.worker_external_certifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY wec_select_own ON public.worker_external_certifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY wec_admin_safety_all ON public.worker_external_certifications
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role IN ('admin', 'safety_officer'))
  );
