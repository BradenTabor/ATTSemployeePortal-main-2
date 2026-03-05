-- =============================================================================
-- SMS Escalation Recipients: extract E.164 from pasted CSV/combined values
-- When phone_e164 contains pasted data (e.g. "+18702809951, Steve Curtis, 0, t"),
-- extract only the first E.164 match so the check constraint passes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sms_escalation_recipients_trim_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extracted text;
BEGIN
  IF NEW.phone_e164 IS NOT NULL THEN
    NEW.phone_e164 := trim(NEW.phone_e164);
    -- Extract first E.164-like substring (+ then 1-9 then 6-14 digits) for paste/CSV errors
    extracted := (regexp_match(NEW.phone_e164, '\+[1-9]\d{6,14}'))[1];
    IF extracted IS NOT NULL THEN
      NEW.phone_e164 := extracted;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sms_escalation_recipients_trim_phone() IS 'Trims phone_e164 and extracts first E.164 substring when user pastes a CSV row or "phone, name, ..." into the field.';
