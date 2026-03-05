-- Add certification_granted notification category for grant/revocation lifecycle events.
-- Workers can toggle this preference independently from certification_expiry (expiry reminders).

-- 1. Add certification_granted to notification_events category check
ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_category_check;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_category_check
  CHECK (category IN (
    'schedule', 'announcement', 'safety_alert', 'job_update',
    'rto_decision', 'admin_notice', 'certification_expiry', 'certification_expiry_digest', 'certification_granted'
  ));

-- 2. Include certification_granted in default preferences for new users
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $$
DECLARE
  cats TEXT[] := ARRAY[
    'schedule', 'announcement', 'safety_alert', 'job_update',
    'rto_decision', 'admin_notice', 'certification_expiry', 'certification_expiry_digest', 'certification_granted'
  ];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    INSERT INTO public.notification_preferences (user_id, category)
    VALUES (NEW.id, cat)
    ON CONFLICT (user_id, category) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Seed certification_granted for existing users (push_enabled true)
INSERT INTO public.notification_preferences (user_id, category, push_enabled)
SELECT id, 'certification_granted', true
FROM auth.users
ON CONFLICT (user_id, category) DO NOTHING;
