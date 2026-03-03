-- Block modification of user_id on safety form tables (audit trail protection).
-- Ensures the original submitter cannot be changed after the fact.

CREATE OR REPLACE FUNCTION prevent_equipment_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id on submitted inspection records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_equipment_user_id_immutability ON public.daily_equipment_inspections;
CREATE TRIGGER enforce_equipment_user_id_immutability
  BEFORE UPDATE ON public.daily_equipment_inspections
  FOR EACH ROW
  EXECUTE FUNCTION prevent_equipment_user_id_change();

-- Same protection for dvir_reports (in case UPDATE policy is added later).
CREATE OR REPLACE FUNCTION prevent_dvir_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id on submitted DVIR records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_dvir_user_id_immutability ON public.dvir_reports;
CREATE TRIGGER enforce_dvir_user_id_immutability
  BEFORE UPDATE ON public.dvir_reports
  FOR EACH ROW
  EXECUTE FUNCTION prevent_dvir_user_id_change();

-- Same protection for daily_jsa.
CREATE OR REPLACE FUNCTION prevent_jsa_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot modify user_id on submitted JSA records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_jsa_user_id_immutability ON public.daily_jsa;
CREATE TRIGGER enforce_jsa_user_id_immutability
  BEFORE UPDATE ON public.daily_jsa
  FOR EACH ROW
  EXECUTE FUNCTION prevent_jsa_user_id_change();
