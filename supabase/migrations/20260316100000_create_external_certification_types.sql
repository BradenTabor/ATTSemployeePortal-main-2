-- =============================================================================
-- Migration: Create external_certification_types table
-- Purpose: Admin-defined certification definitions for certs earned outside ATTS
--          (PowerSafe, CDL, First Aid, CPR, ISA Arborist, etc.)
-- =============================================================================

CREATE TABLE public.external_certification_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('external', 'regulatory', 'industry', 'safety')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  validity_months INTEGER,
  -- Schema-ready for future integration with cert-expiry-reminders edge function.
  -- At launch, reminders do NOT fire for external certs. Do not build UI that
  -- implies reminders are active for external certs in v1.
  reminder_days INTEGER[] DEFAULT '{30,14,7}',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at (reuses existing project trigger function)
CREATE TRIGGER set_updated_at_external_cert_types
  BEFORE UPDATE ON public.external_certification_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_ect_active ON public.external_certification_types(is_active)
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.external_certification_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
--
-- Policy overlap is intentional: ect_select_authenticated lets non-admins see
-- only active types. ect_admin_all (FOR ALL) grants admins full access including
-- inactive/archived types they need to manage. Postgres OR-combines same-command
-- policies, so admins see everything while non-admins are filtered. Do not
-- "clean up" this overlap — removing ect_admin_all breaks admin visibility of
-- archived types.
CREATE POLICY ect_select_authenticated ON public.external_certification_types
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY ect_admin_all ON public.external_certification_types
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid() AND role = 'admin')
  );
