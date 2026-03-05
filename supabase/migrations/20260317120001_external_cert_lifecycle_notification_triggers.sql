-- Triggers on worker_external_certifications to create notification_events for
-- grant (when status becomes active) and revocation. Revocations respect the
-- worker's certification_granted preference (see plan: decision documented).
-- Cert name lookup: fallback to 'A certification' if type is missing/archived.

CREATE OR REPLACE FUNCTION public.notify_external_cert_grant_or_revoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert_name TEXT;
  ev_title TEXT;
  ev_body TEXT;
  ev_severity TEXT;
BEGIN
  -- Grant: INSERT with status = 'active', or UPDATE to status = 'active'
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active') THEN
    SELECT name INTO cert_name
    FROM public.external_certification_types
    WHERE id = NEW.external_certification_type_id;
    cert_name := COALESCE(NULLIF(TRIM(cert_name), ''), 'A certification');

    ev_title := 'New Certification Added';
    ev_body := 'You''ve been awarded ' || cert_name || '. View it on your profile.';
    ev_severity := 'low';

    INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, entity_type, entity_id)
    VALUES (
      'certification_granted',
      ev_severity,
      'user',
      NEW.user_id::TEXT,
      ev_title,
      ev_body,
      '/profile',
      'worker_external_certification',
      NEW.id
    );
    RETURN NEW;
  END IF;

  -- Revocation: UPDATE to status = 'revoked'
  IF TG_OP = 'UPDATE' AND NEW.status = 'revoked' AND (OLD.status IS NULL OR OLD.status <> 'revoked') THEN
    SELECT name INTO cert_name
    FROM public.external_certification_types
    WHERE id = NEW.external_certification_type_id;
    cert_name := COALESCE(NULLIF(TRIM(cert_name), ''), 'A certification');

    ev_title := 'Certification Revoked';
    ev_body := cert_name || ' has been revoked. Contact your supervisor for details.';
    ev_severity := 'high';

    INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, entity_type, entity_id)
    VALUES (
      'certification_granted',
      ev_severity,
      'user',
      NEW.user_id::TEXT,
      ev_title,
      ev_body,
      '/profile',
      'worker_external_certification',
      NEW.id
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_worker_external_cert_notify ON public.worker_external_certifications;
CREATE TRIGGER trg_worker_external_cert_notify
  AFTER INSERT OR UPDATE OF status
  ON public.worker_external_certifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_external_cert_grant_or_revoke();

COMMENT ON FUNCTION public.notify_external_cert_grant_or_revoke() IS
  'Creates notification_events for external cert grant (status=active) and revocation. Delivery respects user certification_granted preference. Run docs/NotificationEventDispatch_webhook.sql once (replace placeholders) so INSERTs trigger notifications-dispatch; see docs/NotificationEventDispatch.md.';
