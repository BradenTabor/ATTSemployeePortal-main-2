-- Worker Qualification Registry — OSHA 1910.269(r) 3-tier electrical qualification
-- Adds qualification level, date, and verifier to app_users; seeds electrical_qualification cert type for history.

-- Add qualification level to users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS electrical_qualification_level TEXT
    CHECK (electrical_qualification_level IN ('unqualified', 'line_clearance_tree_trimmer', 'qualified_269'))
    DEFAULT 'unqualified';

-- Add qualification history tracking
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS electrical_qualification_date DATE,
  ADD COLUMN IF NOT EXISTS electrical_qualification_verified_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.app_users.electrical_qualification_level IS 'OSHA 1910.269(r) 3-tier: unqualified, line-clearance tree trimmer, 269-qualified';
COMMENT ON COLUMN public.app_users.electrical_qualification_date IS 'Date when qualification was last assigned/verified';
COMMENT ON COLUMN public.app_users.electrical_qualification_verified_by IS 'app_users.id of admin/SO who verified the qualification';

-- Seed electrical_qualification certification type for history tracking in certification_records
INSERT INTO public.certification_types (
  name,
  slug,
  description,
  category,
  passing_score,
  validity_months,
  has_written_test,
  has_practical_eval,
  is_active
) VALUES (
  'Electrical Qualification (1910.269)',
  'electrical-qualification',
  'OSHA 1910.269(r) electrical qualification level (unqualified, line-clearance tree trimmer, 269-qualified). Used for history in certification_records.',
  'safety',
  0,
  120,
  false,
  false,
  true
) ON CONFLICT (slug) DO NOTHING;
