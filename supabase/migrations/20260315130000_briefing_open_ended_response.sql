-- Optional open-ended response for daily safety briefing (Phase 3 item 8).
-- "What's one thing you'll watch for on your site today?" — optional, not required to complete.

ALTER TABLE public.safety_briefing_answers
  ADD COLUMN IF NOT EXISTS open_ended_response text;

COMMENT ON COLUMN public.safety_briefing_answers.open_ended_response IS
  'Optional free-text response to open-ended prompt (e.g. what worker will watch for today). Max length enforced in app; moderation before next-day surfacing.';
