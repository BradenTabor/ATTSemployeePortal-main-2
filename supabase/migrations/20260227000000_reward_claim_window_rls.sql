-- Restrict safety reward claims to 7:00–9:00 AM America/Chicago.
-- 7 AM is when the safety announcement is published; 9 AM is the compliance cutoff.

-- Function: true when current Chicago time is within [07:00, 09:00)
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (NOW() AT TIME ZONE 'America/Chicago')::time >= '07:00'::time
    AND (NOW() AT TIME ZONE 'America/Chicago')::time < '09:00'::time
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true only between 7:00 and 9:00 AM America/Chicago; used to restrict announcement_rewards INSERTs.';

-- RLS: require claim window for INSERT
DROP POLICY IF EXISTS "Rewards insert own" ON public.announcement_rewards;

CREATE POLICY "Rewards insert own" ON public.announcement_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_reward_claim_window()
  );

-- Trigger: raise friendly error when insert attempted outside window (e.g. API/direct call)
CREATE OR REPLACE FUNCTION public.check_reward_claim_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_reward_claim_window() THEN
    RAISE EXCEPTION 'Safety rewards can only be claimed between 7 AM and 9 AM Central time.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_reward_claim_window ON public.announcement_rewards;

CREATE TRIGGER trigger_reward_claim_window
  BEFORE INSERT ON public.announcement_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reward_claim_window();
