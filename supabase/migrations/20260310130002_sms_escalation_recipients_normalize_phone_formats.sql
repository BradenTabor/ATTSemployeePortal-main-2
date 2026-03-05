-- =============================================================================
-- SMS Escalation Recipients: accept human-readable phone formats
-- Normalize '+1 870-280-9951' or '870-280-9951' to E.164 '+18702809951'.
-- Still extracts first E.164 from pasted CSV (e.g. "+18702809951, Steve Curtis").
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sms_escalation_recipients_trim_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits_only text;
  normalized text;
  extracted text;
BEGIN
  IF NEW.phone_e164 IS NOT NULL THEN
    NEW.phone_e164 := trim(NEW.phone_e164);
    -- Strip all non-digits so '+1 870-280-9951' or '870-280-9951' can be normalized
    digits_only := regexp_replace(NEW.phone_e164, '\D', '', 'g');
    IF length(digits_only) = 10 THEN
      normalized := '+1' || digits_only;
    ELSIF length(digits_only) = 11 AND left(digits_only, 1) = '1' THEN
      normalized := '+' || digits_only;
    ELSIF length(digits_only) BETWEEN 7 AND 15 THEN
      normalized := '+' || digits_only;
    ELSE
      normalized := NULL;
    END IF;
    IF normalized IS NOT NULL AND normalized ~ '^\+[1-9]\d{6,14}$' THEN
      NEW.phone_e164 := normalized;
    ELSE
      -- Fallback: extract first E.164 substring (e.g. pasted CSV "+18702809951, Steve Curtis")
      extracted := (regexp_match(NEW.phone_e164, '\+[1-9]\d{6,14}'))[1];
      IF extracted IS NOT NULL THEN
        NEW.phone_e164 := extracted;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sms_escalation_recipients_trim_phone() IS 'Normalizes phone_e164: strips non-digits and builds E.164 (+1 for 10-digit US), or extracts first E.164 from pasted CSV. Accepts "+1 870-280-9951", "870-280-9951", "+18702809951".';
