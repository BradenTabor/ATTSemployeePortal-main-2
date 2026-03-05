-- Seed external certification types relevant to utility tree service operations.
-- Uses ON CONFLICT (slug) DO NOTHING so re-running is safe.

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT user_id INTO v_admin_id
  FROM public.app_users
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No admin user found — skipping external cert type seed.';
    RETURN;
  END IF;

  INSERT INTO public.external_certification_types
    (name, slug, description, category, is_required, validity_months, created_by)
  VALUES
    ('CDL Class A', 'cdl-class-a', 'Commercial Driver''s License — Class A', 'regulatory', false, 48, v_admin_id),
    ('CDL Class B', 'cdl-class-b', 'Commercial Driver''s License — Class B', 'regulatory', false, 48, v_admin_id),
    ('First Aid / CPR', 'first-aid-cpr', 'First Aid and CPR certification', 'safety', false, 24, v_admin_id),
    ('ISA Certified Arborist', 'isa-certified-arborist', 'International Society of Arboriculture Certified Arborist', 'industry', false, 36, v_admin_id),
    ('ISA Tree Risk Assessment Qualification', 'isa-traq', 'ISA Tree Risk Assessment Qualification (TRAQ)', 'industry', false, 60, v_admin_id),
    ('PowerSafe Line Clearance', 'powersafe-line-clearance', 'PowerSafe Line Clearance training certification', 'external', false, 12, v_admin_id),
    ('OSHA 10-Hour Construction', 'osha-10-construction', 'OSHA 10-Hour Construction Safety & Health', 'regulatory', false, NULL, v_admin_id),
    ('OSHA 30-Hour Construction', 'osha-30-construction', 'OSHA 30-Hour Construction Safety & Health', 'regulatory', false, NULL, v_admin_id),
    ('Flagger Certification', 'flagger-cert', 'Traffic control / flagger certification', 'safety', false, 36, v_admin_id),
    ('Herbicide Applicator License', 'herbicide-applicator', 'State herbicide / pesticide applicator license', 'regulatory', false, 12, v_admin_id),
    ('Crane Operator Certification', 'crane-operator', 'NCCCO or equivalent crane operator certification', 'industry', false, 60, v_admin_id)
  ON CONFLICT (slug) DO NOTHING;
END;
$$;
