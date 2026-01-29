/*
  Server-side validation (P0): Recordable incidents must have
  body_parts_affected and what_doing_before per OSHA 300/301.
*/

CREATE OR REPLACE FUNCTION public.validate_recordable_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.severity IN ('recordable', 'lost_time', 'fatality') THEN
    IF NEW.body_parts_affected IS NULL OR array_length(NEW.body_parts_affected, 1) IS NULL OR array_length(NEW.body_parts_affected, 1) < 1 THEN
      RAISE EXCEPTION 'OSHA 300: At least one body part affected is required for recordable incidents.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.what_doing_before IS NULL OR trim(NEW.what_doing_before) = '' THEN
      RAISE EXCEPTION 'OSHA 301: "What was employee doing before incident" is required for recordable incidents.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_recordable_incident() IS
  'Enforces OSHA 300/301: recordable incidents must have body_parts_affected and what_doing_before.';

DROP TRIGGER IF EXISTS trigger_validate_recordable_incident ON public.safety_incidents;
CREATE TRIGGER trigger_validate_recordable_incident
  BEFORE INSERT OR UPDATE ON public.safety_incidents
  FOR EACH ROW EXECUTE FUNCTION public.validate_recordable_incident();
