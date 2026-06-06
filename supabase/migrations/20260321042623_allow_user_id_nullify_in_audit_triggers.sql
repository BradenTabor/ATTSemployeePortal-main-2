-- Allow FK SET NULL cascade on user deletion while preserving audit trail protection.
--
-- Three BEFORE UPDATE triggers block ANY change to user_id on safety form tables
-- (dvir_reports, daily_equipment_inspections, daily_jsa). This prevents the
-- ON DELETE SET NULL cascade from auth.users, causing "Database error deleting user".
--
-- Fix: allow user_id → NULL (anonymization on deletion) but still block
-- user_id → different UUID (record reassignment / audit trail tampering).
--
-- dvir_reports and daily_equipment_inspections use ON DELETE SET NULL, so their
-- triggers actively block deletion today. daily_jsa uses ON DELETE CASCADE (row
-- deletion, no UPDATE trigger fires), so its trigger is not currently a blocker —
-- but we fix it for forward-compatibility in case the FK is later changed to
-- SET NULL to match the pattern used on the other safety form tables.

CREATE OR REPLACE FUNCTION prevent_dvir_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reassign user_id on submitted DVIR records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_equipment_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reassign user_id on submitted inspection records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_jsa_user_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reassign user_id on submitted JSA records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
