-- Auto-sync app_users.electrical_qualification_level when the electrical-qualification
-- cert record moves to 'active'. Keeps the denormalized column on app_users in sync
-- so JSA electrical hazard checks (useCrewQualifications) work without joining cert tables.

CREATE OR REPLACE FUNCTION public.sync_electrical_qualification_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert_slug TEXT;
BEGIN
  SELECT slug INTO v_cert_slug
  FROM public.certification_types
  WHERE id = NEW.certification_type_id;

  IF v_cert_slug = 'electrical-qualification' AND NEW.status = 'active' THEN
    UPDATE public.app_users
    SET
      electrical_qualification_level = 'qualified_269',
      electrical_qualification_date = CURRENT_DATE,
      electrical_qualification_verified_by = (
        SELECT id FROM public.app_users WHERE user_id = NEW.certified_by LIMIT 1
      )
    WHERE user_id = NEW.user_id;
  END IF;

  IF v_cert_slug = 'electrical-qualification' AND NEW.status IN ('expired', 'revoked') THEN
    UPDATE public.app_users
    SET electrical_qualification_level = 'unqualified'
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_electrical_level ON public.certification_records;
CREATE TRIGGER trg_sync_electrical_level
  AFTER INSERT OR UPDATE OF status ON public.certification_records
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_electrical_qualification_level();

COMMENT ON FUNCTION public.sync_electrical_qualification_level() IS
  'Keeps app_users.electrical_qualification_level in sync when electrical-qualification cert becomes active/expired/revoked.';
