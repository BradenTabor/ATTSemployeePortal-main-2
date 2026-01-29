-- Enforce that only the latest announcement (by created_at) can be claimed.
-- Matches frontend "latest signal" definition and prevents API abuse.

CREATE OR REPLACE FUNCTION public.check_latest_announcement_claim()
RETURNS TRIGGER AS $$
DECLARE
  latest_announcement_id UUID;
BEGIN
  SELECT id INTO latest_announcement_id
  FROM public.announcements
  ORDER BY created_at DESC
  LIMIT 1;

  IF NEW.announcement_id IS DISTINCT FROM latest_announcement_id THEN
    RAISE EXCEPTION 'Only the latest announcement can be claimed (ID: %)', COALESCE(latest_announcement_id::text, 'none');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_latest_announcement_claim ON public.announcement_rewards;

CREATE TRIGGER enforce_latest_announcement_claim
  BEFORE INSERT ON public.announcement_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.check_latest_announcement_claim();
