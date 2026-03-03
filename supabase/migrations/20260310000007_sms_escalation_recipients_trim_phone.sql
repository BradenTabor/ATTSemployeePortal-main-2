-- Trim phone_e164 so leading/trailing spaces don't violate E.164 check.
-- Fix existing rows and prevent future ones via trigger.

UPDATE public.sms_escalation_recipients
SET phone_e164 = trim(phone_e164)
WHERE phone_e164 IS NOT NULL AND phone_e164 <> trim(phone_e164);

CREATE OR REPLACE FUNCTION public.sms_escalation_recipients_trim_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone_e164 IS NOT NULL THEN
    NEW.phone_e164 := trim(NEW.phone_e164);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sms_escalation_recipients_trim_phone_trigger ON public.sms_escalation_recipients;
CREATE TRIGGER sms_escalation_recipients_trim_phone_trigger
  BEFORE INSERT OR UPDATE OF phone_e164
  ON public.sms_escalation_recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.sms_escalation_recipients_trim_phone();

COMMENT ON FUNCTION public.sms_escalation_recipients_trim_phone() IS 'Trims phone_e164 so E.164 check passes when user pastes a value with spaces.';
